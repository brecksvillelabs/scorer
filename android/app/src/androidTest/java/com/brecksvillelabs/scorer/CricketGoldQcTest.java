package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class CricketGoldQcTest {

    @Test
    public void packagedCricketGoldFlowPersistsRosterAndKeepsLiveScorecard() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            evaluate(webView, "localStorage.clear(); location.reload(); 'reloading'");
            waitForJsTrue(webView,
                "Boolean(document.querySelector('.sport-choice[data-sport=cricket]') && document.querySelector('[data-manage-roster=A]'))",
                20000,
                "Cricket Gold setup layer"
            );

            // Sport selection has multiple listeners (core setup, Quick Start and
            // saved-team enhancements). Let that event settle before filling and
            // saving the team so the packaged WebView test mirrors a real user tap.
            evaluate(webView, "document.querySelector('.sport-choice[data-sport=cricket]').click(); 'cricket-selected'");
            waitForJsTrue(webView,
                "document.querySelector('.sport-choice.active')?.dataset.sport==='cricket'",
                8000,
                "Cricket setup selection"
            );

            evaluate(webView,
                "document.getElementById('inputNameA').value='India';" +
                "document.getElementById('inputNameB').value='Pakistan';" +
                "document.getElementById('inputRosterA').value='Kohli\\nRahul\\nRohit\\nGill';" +
                "document.getElementById('inputRosterB').value='Shaheen\\nNaseem\\nBabar\\nRizwan';" +
                "document.getElementById('saveFavoriteA').click();" +
                "window.__cricketGoldSavedId=(JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]').find(t=>t.sport==='cricket' && t.name==='India')||{}).id||''; 'configured'"
            );

            waitForJsTrue(webView,
                "Boolean(window.__cricketGoldSavedId && JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]').some(t=>t.id===window.__cricketGoldSavedId && t.name==='India') && document.getElementById('favoriteSelectA').value===window.__cricketGoldSavedId)",
                8000,
                "saved India team identity"
            );

            evaluate(webView,
                "document.querySelector('[data-manage-roster=A]').click();" +
                "document.getElementById('rosterPlayerInput').value='Surya';" +
                "document.getElementById('addRosterPlayerBtn').click(); 'added'"
            );
            waitForJsTrue(webView,
                "(() => { const list=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]'); const t=list.find(x=>x.id===window.__cricketGoldSavedId); return Boolean(t && t.roster.includes('Surya') && document.getElementById('favoriteSelectA').value===window.__cricketGoldSavedId); })()",
                8000,
                "auto-saved roster addition with stable team id"
            );

            evaluate(webView,
                "(() => { const buttons=[...document.querySelectorAll('#rosterPlayerList [data-remove-roster-index]')]; buttons.at(-1)?.click(); return 'removed'; })()"
            );
            waitForJsTrue(webView,
                "(() => { const list=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]'); const t=list.find(x=>x.id===window.__cricketGoldSavedId); return Boolean(t && !t.roster.includes('Surya') && t.name==='India' && document.getElementById('favoriteSelectA').value===window.__cricketGoldSavedId); })()",
                8000,
                "auto-saved roster removal with stable team id"
            );
            evaluate(webView, "document.getElementById('doneRosterManagerBtn').click(); document.getElementById('startGameBtn').click(); 'started'");

            waitForJsTrue(webView,
                "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && s.sport==='cricket' && s.teamA.name==='India' && s.teamB.name==='Pakistan' && s.teamA.roster.includes('Gill')); })()",
                10000,
                "started India versus Pakistan Cricket match"
            );

            clickDeliveryAndWait(webView, "4", "s.teamA.runs===4 && s.teamA.balls===1");
            clickDeliveryAndWait(webView, "wide", "s.teamA.runs===5 && s.teamA.balls===1");
            clickDeliveryAndWait(webView, "1", "s.teamA.runs===6 && s.teamA.balls===2");
            clickDeliveryAndWait(webView, "wicket", "s.teamA.runs===6 && s.teamA.wickets===1 && s.teamA.balls===3");

            evaluate(webView, "document.getElementById('fullScoreboardBtn').click(); 'opened'");
            waitForJsTrue(webView,
                "Boolean(document.querySelector('#fullScoreboardContent [data-cricket-gold-scorecard=true]'))",
                8000,
                "Cricket Gold scorecard layer"
            );
            waitForJsTrue(webView,
                "(() => { const text=document.getElementById('fullScoreboardContent')?.innerText||''; return text.includes('India') && text.includes('Pakistan'); })()",
                8000,
                "Cricket Gold innings headings"
            );
            waitForJsTrue(webView,
                "(() => { const text=document.getElementById('fullScoreboardContent')?.innerText||''; return text.includes('Yet to bat'); })()",
                8000,
                "Cricket Gold yet-to-bat section"
            );
            waitForJsTrue(webView,
                "(() => { const text=document.getElementById('fullScoreboardContent')?.innerText||''; return text.includes('Fall of wickets'); })()",
                8000,
                "Cricket Gold fall-of-wickets section"
            );
            waitForJsTrue(webView,
                "(() => { const text=document.getElementById('fullScoreboardContent')?.innerText||''; return text.includes('Bowling') && text.includes('WD') && text.includes('NB'); })()",
                8000,
                "Cricket Gold bowling table"
            );

            // Score another legal dot while the scorecard overlay is open. app.js
            // rerenders its normal full scorecard on every state change; the Gold
            // layer must restore the enhanced Cricket card immediately.
            clickDeliveryAndWait(webView, "0", "s.teamA.balls===4");
            waitForJsTrue(webView,
                "Boolean(document.querySelector('#fullScoreboardContent [data-cricket-gold-scorecard=true]'))",
                8000,
                "live Cricket Gold scorecard after a scoring rerender"
            );

            assertTrue("Cricket share control should remain available",
                "true".equals(evaluate(webView,
                    "Boolean(document.getElementById('shareScoreBtn') && !document.getElementById('shareScoreBtn').disabled && document.getElementById('shareScoreSheetBtn')?.textContent.includes('WhatsApp'))"
                ))
            );
        }
    }

    private void clickDeliveryAndWait(WebView webView, String value, String statePredicate) throws Exception {
        evaluate(webView,
            "document.querySelector('[data-action=cricket][data-value=\"" + value + "\"]')?.click(); 'clicked'"
        );
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && " + statePredicate + "); })()",
            8000,
            "Cricket delivery " + value
        );
    }

    private void waitForJsTrue(WebView webView, String script, long timeoutMs, String description) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        do {
            if ("true".equals(evaluate(webView, script))) return;
            SystemClock.sleep(150);
        } while (SystemClock.elapsedRealtime() < deadline);
        throw new AssertionError("Timed out waiting for packaged Scorer " + description);
    }

    private String evaluate(WebView webView, String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        webView.post(() -> webView.evaluateJavascript(script, value -> {
            result.set(value);
            latch.countDown();
        }));
        assertTrue("Timed out evaluating Cricket Gold JavaScript", latch.await(20, TimeUnit.SECONDS));
        return result.get();
    }
}
