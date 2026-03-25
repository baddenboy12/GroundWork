package com.teezfpo.groundwork;

import android.graphics.Color;
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
        // Register the auth dialog plugin BEFORE super.onCreate
        // so it's available when Capacitor initializes
        registerPlugin(AuthDialogPlugin.class);

        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#0f1117"));
        window.setNavigationBarColor(Color.parseColor("#0f1117"));

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
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
}
