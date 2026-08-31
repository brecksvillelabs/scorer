package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.NotificationManager;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NotificationDeliveryTest {

    private static final String PACKAGE_NAME = "com.brecksvillelabs.scorer";
    private static final int IMMEDIATE_TEST_ID = 2147482990;
    private NotificationManager notificationManager;

    @Before
    public void grantNotificationsAndClearShade() throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            executeShellCommand("pm grant " + PACKAGE_NAME + " " + Manifest.permission.POST_NOTIFICATIONS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            executeShellCommand("appops set " + PACKAGE_NAME + " SCHEDULE_EXACT_ALARM deny");
        }
        notificationManager = InstrumentationRegistry.getInstrumentation()
            .getTargetContext()
            .getSystemService(NotificationManager.class);
        assertNotNull(notificationManager);
        notificationManager.cancel(IMMEDIATE_TEST_ID);
    }

    @After
    public void clearTestNotification() {
        if (notificationManager != null) notificationManager.cancel(IMMEDIATE_TEST_ID);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                executeShellCommand("appops set " + PACKAGE_NAME + " SCHEDULE_EXACT_ALARM default");
            } catch (IOException ignored) {
            }
        }
    }

    @Test
    public void immediateBridgeNotificationPostsWithoutExactAlarmAccess() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            SystemClock.sleep(1500);
            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            // Drive the packaged user path instead of importing a module from an
            // evaluateJavascript script (Chromium gives injected dynamic imports
            // an about:blank base URL). This clicks through v040.js into the real
            // Capacitor LocalNotifications bridge.
            waitForJsTrue(webView, "Boolean(document.getElementById('v040Upcoming'))", 20000);
            evaluate(webView, "document.getElementById('v040Upcoming').click(); 'opened'");
            waitForJsTrue(webView,
                "(() => { const button = document.querySelector('[data-v041-native-action=now]'); return Boolean(button && !button.disabled); })()",
                10000
            );
            evaluate(webView, "document.querySelector('[data-v041-native-action=now]').click(); 'sent'");

            boolean active = false;
            long deadline = SystemClock.elapsedRealtime() + 10000;
            do {
                for (StatusBarNotification notification : notificationManager.getActiveNotifications()) {
                    if (notification.getId() == IMMEDIATE_TEST_ID) {
                        active = true;
                        break;
                    }
                }
                if (!active) SystemClock.sleep(100);
            } while (!active && SystemClock.elapsedRealtime() < deadline);

            assertTrue("Android notification manager did not expose the Scorer test notification", active);
        }
    }

    private void waitForJsTrue(WebView webView, String script, long timeoutMs) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        do {
            if ("true".equals(evaluate(webView, script))) return;
            SystemClock.sleep(200);
        } while (SystemClock.elapsedRealtime() < deadline);
        throw new AssertionError("Timed out waiting for Scorer's packaged notification controls");
    }

    private String evaluate(WebView webView, String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        webView.post(() -> webView.evaluateJavascript(script, value -> {
            result.set(value);
            latch.countDown();
        }));
        // A cold API 35 emulator can spend several seconds starting WebView and
        // loading the packaged modules. Keep this long enough for that first
        // render while still failing deterministically if the bridge is stuck.
        assertTrue("Timed out evaluating notification JavaScript", latch.await(20, TimeUnit.SECONDS));
        return result.get();
    }

    private void executeShellCommand(String command) throws IOException {
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        try (InputStream output = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
            byte[] buffer = new byte[256];
            while (output.read(buffer) != -1) {
                // Drain the command output so the operation has completed.
            }
        }
    }
}
