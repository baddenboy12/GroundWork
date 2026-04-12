package com.teezfpo.groundwork;

import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {

    // Bump this value whenever the deployment URL changes to force a data wipe
    // on existing installs. This clears stale OIDC tokens and cached Convex data.
    private static final int DATA_VERSION = 2;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the auth dialog plugin BEFORE super.onCreate
        // so it's available when Capacitor initializes
        registerPlugin(AuthDialogPlugin.class);

        // Clear stale WebView data when the deployment changes.
        // Android WebView persists cookies and localStorage across app reinstalls,
        // so switching from dev to prod (or vice versa) leaves behind stale auth
        // tokens and cached data from the wrong deployment.
        clearStaleDataIfNeeded();

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

    /**
     * Clears all WebView data (cookies, localStorage, cache) if the data version
     * has changed since the last run. This ensures stale auth sessions and cached
     * data from a different Convex deployment don't bleed into the current build.
     */
    private void clearStaleDataIfNeeded() {
        SharedPreferences prefs = getSharedPreferences("groundwork_app", MODE_PRIVATE);
        int storedVersion = prefs.getInt("data_version", 0);

        if (storedVersion < DATA_VERSION) {
            // Clear all cookies (kills Keycloak session)
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.removeAllCookies(null);
            cookieManager.flush();

            // Clear all WebView localStorage and databases
            WebStorage.getInstance().deleteAllData();

            // Save the new version so we don't wipe on every launch
            prefs.edit().putInt("data_version", DATA_VERSION).apply();
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
