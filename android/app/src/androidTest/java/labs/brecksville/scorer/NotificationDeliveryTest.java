package labs.brecksville.scorer;

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
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NotificationDeliveryTest {

    private static final String PACKAGE_NAME = "labs.brecksville.scorer";
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

            String start = evaluate(webView,
                "(() => {" +
                "window.__scorerNotificationTest = 'pending';" +
                "import('./native-bridge.js').then(async module => {" +
                "try { window.__scorerNotificationTest = JSON.stringify(await module.sendImmediateTestNotification()); }" +
                "catch (error) { window.__scorerNotificationTest = JSON.stringify({error:error?.message || String(error)}); }" +
                "});" +
                "return 'started';" +
                "})()"
            );
            assertTrue(start.contains("started"));

            JSONObject bridgeResult = waitForBridgeResult(webView);
            assertTrue("Bridge result: " + bridgeResult, bridgeResult.optBoolean("delivered"));

            boolean active = false;
            long deadline = SystemClock.elapsedRealtime() + 3000;
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

    private JSONObject waitForBridgeResult(WebView webView) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 10000;
        do {
            String value = decodeJsString(evaluate(webView, "window.__scorerNotificationTest"));
            if (value != null && !"pending".equals(value)) return new JSONObject(value);
            SystemClock.sleep(200);
        } while (SystemClock.elapsedRealtime() < deadline);
        throw new AssertionError("Timed out waiting for the Scorer notification bridge result");
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

    private String decodeJsString(String value) throws Exception {
        if (value == null || "null".equals(value)) return null;
        return new JSONArray("[" + value + "]").getString(0);
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
