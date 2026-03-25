package com.teezfpo.groundwork;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
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

        // Apply system bar insets as padding on the WebView's parent layout.
        // This pushes content below the status bar at the Android layout level
        // — no CSS hacks or JS injection needed, and no visible jump on load.
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            View parent = (View) bridge.getWebView().getParent();
            ViewCompat.setOnApplyWindowInsetsListener(parent, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                // Trim top inset slightly for a tighter feel
                int topInset = Math.max(0, insets.top - (int)(8 * getResources().getDisplayMetrics().density));
                v.setPadding(insets.left, topInset, insets.right, insets.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            // Request insets to be applied immediately
            parent.requestApplyInsets();
        }
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
