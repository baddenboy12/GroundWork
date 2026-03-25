package com.teezfpo.groundwork;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(android.graphics.Color.parseColor("#0f1117"));
        window.setNavigationBarColor(android.graphics.Color.parseColor("#0f1117"));

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);

        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleDeepLink(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) return;

        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings settings = bridge.getWebView().getSettings();
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
        }
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();

        if ("groundwork".equals(uri.getScheme())) {
            String query = uri.getQuery();
            String localUrl = "https://groundwork.teezfpo.com/auth/callback";
            if (query != null) localUrl += "?" + query;

            Bridge bridge = getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                final String url = localUrl;
                bridge.getWebView().post(() -> bridge.getWebView().loadUrl(url));
            }
        }
    }
}
