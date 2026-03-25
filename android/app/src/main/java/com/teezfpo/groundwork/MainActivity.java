package com.teezfpo.groundwork;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        super.onResume();

        Window window = getWindow();

        // Force content below the status bar (override Capacitor's edge-to-edge)
        WindowCompat.setDecorFitsSystemWindows(window, true);

        // Dark status bar with light icons
        window.setStatusBarColor(android.graphics.Color.parseColor("#0f1117"));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);

        // Match navigation bar
        window.setNavigationBarColor(android.graphics.Color.parseColor("#0f1117"));
    }

    @Override
    public void onStart() {
        super.onStart();

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // Enable wide viewport so the WebView fits the 768px layout to screen
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Allow the WebView to navigate to Keycloak and PayPal within the app
        webView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if (host == null) return false;

                if (host.equals("auth.teezfpo.com") ||
                    host.equals("groundwork.teezfpo.com") ||
                    host.endsWith(".paypal.com")) {
                    return false;
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
