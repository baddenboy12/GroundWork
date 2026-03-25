package com.teezfpo.groundwork;

import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Custom Capacitor plugin that intercepts navigation to auth.teezfpo.com
 * and opens it in a fullscreen dialog WebView (no URL bar).
 * When auth completes, extracts the code and loads the callback in the main WebView.
 */
@CapacitorPlugin(name = "AuthDialog")
public class AuthDialogPlugin extends Plugin {

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String host = url.getHost();

        // Intercept navigation to Keycloak auth endpoint
        if ("auth.teezfpo.com".equals(host)) {
            getActivity().runOnUiThread(() -> openAuthDialog(url.toString()));
            return true; // prevent the WebView/Capacitor from handling it
        }

        return null; // let other plugins or Capacitor handle it
    }

    private void openAuthDialog(String authUrl) {
        Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        // Track whether auth completed successfully (code was extracted)
        final boolean[] authCompleted = { false };

        WebView authWebView = new WebView(getActivity());
        WebSettings settings = authWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        authWebView.setBackgroundColor(Color.parseColor("#0f1117"));

        authWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String redirectHost = uri.getHost();

                // Intercept redirect back to our app
                if ("groundwork.teezfpo.com".equals(redirectHost) ||
                    "groundwork".equals(scheme)) {

                    String code = uri.getQueryParameter("code");
                    String state = uri.getQueryParameter("state");
                    String sessionState = uri.getQueryParameter("session_state");

                    if (code != null && state != null) {
                        authCompleted[0] = true;
                        String callbackUrl = "https://groundwork.teezfpo.com/auth/native-callback"
                            + "?code=" + Uri.encode(code)
                            + "&state=" + Uri.encode(state)
                            + (sessionState != null ? "&session_state=" + Uri.encode(sessionState) : "");

                        getBridge().getWebView().post(() -> {
                            getBridge().getWebView().loadUrl(callbackUrl);
                        });
                    }

                    dialog.dismiss();
                    return true;
                }

                // Allow Keycloak pages to load normally
                return false;
            }
        });

        authWebView.setWebChromeClient(new WebChromeClient());

        FrameLayout container = new FrameLayout(getActivity());
        container.setBackgroundColor(Color.parseColor("#0f1117"));
        container.addView(authWebView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));

        dialog.setContentView(container);
        dialog.setCancelable(true);

        // When the dialog is dismissed without completing auth (user pressed back),
        // notify the web layer so it can clean up orphaned OIDC state and stop
        // the infinite loading spinner.
        dialog.setOnDismissListener(d -> {
            if (!authCompleted[0]) {
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('authDialogCancelled'))", null);
                });
            }
        });

        dialog.show();

        authWebView.loadUrl(authUrl);
    }
}
