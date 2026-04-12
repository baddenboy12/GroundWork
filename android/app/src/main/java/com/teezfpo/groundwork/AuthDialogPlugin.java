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
 * Custom Capacitor plugin that intercepts navigation to external services
 * (Keycloak auth, Stripe Checkout) and opens them in a fullscreen dialog
 * WebView (no URL bar) so the user stays inside the app.
 *
 * When the external flow completes and redirects back to groundwork.teezfpo.com,
 * the dialog loads the return URL in the main WebView and dismisses itself.
 */
@CapacitorPlugin(name = "AuthDialog")
public class AuthDialogPlugin extends Plugin {

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String host = url.getHost();

        // Intercept navigation to Keycloak auth endpoint
        if ("auth.teezfpo.com".equals(host)) {
            getActivity().runOnUiThread(() -> openDialog(url.toString(), "auth"));
            return true;
        }

        // Intercept navigation to Stripe Checkout
        if ("checkout.stripe.com".equals(host)) {
            getActivity().runOnUiThread(() -> openDialog(url.toString(), "checkout"));
            return true;
        }

        return null; // let other plugins or Capacitor handle it
    }

    private void openDialog(String targetUrl, String dialogType) {
        Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        // Track whether the flow completed (redirect back to app was detected)
        final boolean[] completed = { false };

        WebView dialogWebView = new WebView(getActivity());
        WebSettings settings = dialogWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        dialogWebView.setBackgroundColor(Color.parseColor("#0f1117"));

        dialogWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String redirectHost = uri.getHost();

                // Intercept redirect back to our app
                if ("groundwork.teezfpo.com".equals(redirectHost) ||
                    "groundwork".equals(scheme)) {

                    completed[0] = true;

                    if ("auth".equals(dialogType)) {
                        // Keycloak: extract code/state and build the native callback URL
                        String code = uri.getQueryParameter("code");
                        String state = uri.getQueryParameter("state");
                        String sessionState = uri.getQueryParameter("session_state");

                        if (code != null && state != null) {
                            String callbackUrl = "https://groundwork.teezfpo.com/auth/native-callback"
                                + "?code=" + Uri.encode(code)
                                + "&state=" + Uri.encode(state)
                                + (sessionState != null ? "&session_state=" + Uri.encode(sessionState) : "");

                            getBridge().getWebView().post(() -> {
                                getBridge().getWebView().loadUrl(callbackUrl);
                            });
                        }
                    } else {
                        // Stripe (and any future flows): load the full redirect URL as-is.
                        // The return URL already contains all needed params (session_id, etc.)
                        // and the existing route handler (/stripe/return) processes them.
                        String returnUrl = uri.toString();
                        getBridge().getWebView().post(() -> {
                            getBridge().getWebView().loadUrl(returnUrl);
                        });
                    }

                    dialog.dismiss();
                    return true;
                }

                // Allow external pages (Keycloak forms, Stripe Checkout) to load normally
                return false;
            }
        });

        dialogWebView.setWebChromeClient(new WebChromeClient());

        FrameLayout container = new FrameLayout(getActivity());
        container.setBackgroundColor(Color.parseColor("#0f1117"));
        container.addView(dialogWebView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));

        dialog.setContentView(container);
        dialog.setCancelable(true);

        // When the dialog is dismissed without completing (user pressed back),
        // notify the web layer so it can clean up pending state.
        dialog.setOnDismissListener(d -> {
            if (!completed[0]) {
                String eventName = "auth".equals(dialogType)
                    ? "authDialogCancelled"
                    : "checkoutDialogCancelled";
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('" + eventName + "'))", null);
                });
            }
        });

        dialog.show();

        dialogWebView.loadUrl(targetUrl);
    }
}
