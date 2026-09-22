package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.util.Base64;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MultiSportTournamentQcTest {
    private static final String[] SPORTS = {
        "volleyball","basketball","soccer","football","cricket",
        "tennis","badminton","lacrosse","kabaddi","baseball"
    };
    private static final String[][] PERMUTATIONS = {
        {"A","B"},{"B","A"},{"B","C"},{"C","B"},{"C","A"},{"A","C"}
    };

    @Test
    public void allSportsCreateSavedTeamsAndRunSixPermutationsWithScreenshots() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        runShell(instrumentation, "rm -rf /data/local/tmp/scorer-qc/tournament && mkdir -p /data/local/tmp/scorer-qc/tournament");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);
            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup");
            evaluate(webView, "localStorage.clear(); location.reload(); 'reloading'");
            waitForJsTrue(webView, "document.querySelectorAll('.sport-choice').length>=10", 20000, "ten sport choices");

            int screenshotCount = 0;
            for (String sport : SPORTS) {
                selectSport(webView, sport);
                seedSavedTeams(webView, sport);
                verifySavedTeamLoad(webView, sport);

                int gameNumber = 1;
                for (String[] pairing : PERMUTATIONS) {
                    String left = teamName(sport, pairing[0]);
                    String right = teamName(sport, pairing[1]);
                    startSavedTeamGame(webView, sport, left, right);
                    scoreOneMeaningfulAction(webView, sport);
                    openAndVerifyScoreboard(webView, left, right);

                    String filename = String.format(Locale.US, "%s-%02d-%s-vs-%s.png",
                        sport, gameNumber, pairing[0].toLowerCase(Locale.US), pairing[1].toLowerCase(Locale.US));
                    takeScreenshot(instrumentation, filename);
                    screenshotCount++;

                    evaluate(webView, "document.getElementById('closeFullScoreboardBtn')?.click(); 'closed'");
                    gameNumber++;
                }
            }

            waitForJsTrue(webView,
                "(() => { const x=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]'); return x.length===30; })()",
                8000,
                "30 saved tournament teams"
            );
            assertTrue("Expected 60 tournament screenshots, got " + screenshotCount, screenshotCount == 60);
        }

        String listing = runShell(InstrumentationRegistry.getInstrumentation(),
            "find /data/local/tmp/scorer-qc/tournament -type f -name '*.png' | wc -l");
        assertTrue("Expected 60 screenshot artifacts, shell reported: " + listing,
            listing.trim().endsWith("60"));
    }

    private void selectSport(WebView webView, String sport) throws Exception {
        evaluate(webView, "document.querySelector('.sport-choice[data-sport=\"" + sport + "\"]')?.click(); 'selected'");
        waitForJsTrue(webView,
            "document.querySelector('.sport-choice.active')?.dataset.sport==='" + sport + "'",
            8000,
            sport + " selection"
        );
    }

    private void seedSavedTeams(WebView webView, String sport) throws Exception {
        int expectedRoster = rosterSize(sport);
        String[] colors = {"#2563eb","#e11d48","#0f766e"};
        for (int i = 0; i < 3; i++) {
            String suffix = String.valueOf((char)('A' + i));
            String name = teamName(sport, suffix);
            String roster = rosterText(sport, suffix, expectedRoster);
            String logo = logoDataUrl(sport, suffix, colors[i]);
            String script =
                "document.getElementById('favoriteSelectA').value='';" +
                "document.getElementById('inputNameA').value=" + js(name) + ";" +
                "document.getElementById('inputColorA').value=" + js(colors[i]) + ";" +
                "document.getElementById('inputRosterA').value=" + js(roster) + ";" +
                "document.getElementById('logoPreviewA').innerHTML='<img src=\"" + logo + "\" alt=\"qc logo\">';" +
                "document.getElementById('saveFavoriteA').click(); 'saved'";
            evaluate(webView, script);
            waitForJsTrue(webView,
                "(() => { const x=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
                "const t=x.find(v=>v.sport==='" + sport + "'&&v.name===" + js(name) + ");" +
                "return Boolean(t && t.logo.startsWith('data:image/svg+xml;base64,') && t.roster.length===" + expectedRoster + "); })()",
                8000,
                sport + " saved team " + suffix
            );
        }
    }

    private void verifySavedTeamLoad(WebView webView, String sport) throws Exception {
        int expectedRoster = rosterSize(sport);
        for (String suffix : new String[]{"A","B","C"}) {
            String name = teamName(sport, suffix);
            evaluate(webView,
                "(() => { const x=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
                "const t=x.find(v=>v.sport==='" + sport + "'&&v.name===" + js(name) + ");" +
                "const s=document.getElementById('favoriteSelectA'); s.value=t.id; s.dispatchEvent(new Event('change',{bubbles:true})); return t.id; })()"
            );
            waitForJsTrue(webView,
                "document.getElementById('inputNameA').value===" + js(name) +
                " && document.getElementById('inputRosterA').value.split(/\\n/).filter(Boolean).length===" + expectedRoster +
                " && Boolean(document.querySelector('#logoPreviewA img'))",
                8000,
                sport + " reload saved team " + suffix
            );
        }
    }

    private void startSavedTeamGame(WebView webView, String sport, String left, String right) throws Exception {
        evaluate(webView,
            "document.getElementById('closeFullScoreboardBtn')?.click();" +
            "document.dispatchEvent(new CustomEvent('scorer:prepare-scheduled-game',{detail:{sport:'" + sport + "',teamA:" + js(left) + ",teamB:" + js(right) + "}})); 'prepared'"
        );
        waitForJsTrue(webView,
            "!document.getElementById('setupModal').classList.contains('hidden') && document.querySelector('.sport-choice.active')?.dataset.sport==='" + sport + "'",
            8000,
            sport + " setup for " + left + " vs " + right
        );

        // A real sport-choice tap refreshes the saved-team pickers through the same
        // enhancement event path an owner uses during setup.
        evaluate(webView, "document.querySelector('.sport-choice[data-sport=\"" + sport + "\"]')?.click(); 'refreshed'");
        waitForJsTrue(webView,
            "document.querySelectorAll('#favoriteSelectA option').length>=4 && document.querySelectorAll('#favoriteSelectB option').length>=4",
            8000,
            sport + " favorite pickers"
        );

        evaluate(webView,
            "(() => { const x=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
            "const a=x.find(v=>v.sport==='" + sport + "'&&v.name===" + js(left) + ");" +
            "const b=x.find(v=>v.sport==='" + sport + "'&&v.name===" + js(right) + ");" +
            "const sa=document.getElementById('favoriteSelectA'), sb=document.getElementById('favoriteSelectB');" +
            "sa.value=a.id; sa.dispatchEvent(new Event('change',{bubbles:true}));" +
            "sb.value=b.id; sb.dispatchEvent(new Event('change',{bubbles:true})); return 'loaded'; })()"
        );

        waitForJsTrue(webView,
            "document.getElementById('inputNameA').value===" + js(left) +
            " && document.getElementById('inputNameB').value===" + js(right) +
            " && Boolean(document.querySelector('#logoPreviewA img')) && Boolean(document.querySelector('#logoPreviewB img'))",
            10000,
            sport + " saved teams loaded"
        );

        // Wait for saved logo replay to reach app.js's private pending-logo state
        // through the real file-input change path before starting the game.
        waitForJsTrue(webView,
            "document.getElementById('inputLogoA').files.length===1 && document.getElementById('inputLogoB').files.length===1",
            10000,
            sport + " saved logos replayed"
        );

        evaluate(webView, "document.getElementById('startGameBtn').click(); 'started'");
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && s.sport==='" + sport + "' && s.teamA.name===" + js(left) + " && s.teamB.name===" + js(right) + " && s.teamA.logo && s.teamB.logo && s.teamA.roster.length===" + rosterSize(sport) + " && s.teamB.roster.length===" + rosterSize(sport) + "); })()",
            10000,
            sport + " live game " + left + " vs " + right
        );
    }

    private void scoreOneMeaningfulAction(WebView webView, String sport) throws Exception {
        String script;
        String predicate;
        switch (sport) {
            case "volleyball":
                script = "document.querySelector('[data-action=volleyball-point][data-side=A][data-delta=\"1\"]')?.click(); 'scored'";
                predicate = "s.teamA.score===1";
                break;
            case "basketball":
                script = "document.querySelector('[data-action=simple][data-side=A][data-delta=\"2\"]')?.click(); 'scored'";
                predicate = "s.teamA.score===2";
                break;
            case "soccer":
                script = "document.querySelector('[data-action=simple][data-side=A][data-delta=\"1\"]')?.click(); 'scored'";
                predicate = "s.teamA.score===1";
                break;
            case "football":
                script = "document.querySelector('[data-action=simple][data-side=A][data-delta=\"6\"]')?.click(); 'scored'";
                predicate = "s.teamA.score===6";
                break;
            case "cricket":
                script = "document.querySelector('[data-action=cricket][data-value=\"1\"]')?.click(); 'scored'";
                predicate = "s.teamA.runs===1 && s.teamA.balls===1";
                break;
            case "tennis":
                script = "document.querySelector('[data-action=tennis-point][data-side=A]')?.click(); 'scored'";
                predicate = "s.tennis.points.A===1";
                break;
            case "badminton":
                script = "document.querySelector('[data-action=badminton-point][data-side=A]')?.click(); 'scored'";
                predicate = "s.badminton.points.A===1";
                break;
            case "lacrosse":
                script = "document.querySelector('[data-action=lacrosse-goal][data-side=A][data-delta=\"1\"]')?.click(); 'scored'";
                predicate = "s.teamA.score===1";
                break;
            case "kabaddi":
                script = "document.querySelector('[data-action=kabaddi][data-value=touch]')?.click(); document.querySelector('[data-action=kabaddi][data-value=end]')?.click(); 'scored'";
                predicate = "s.teamA.score===1";
                break;
            case "baseball":
                script = "document.querySelector('[data-action=baseball-run][data-delta=\"1\"]')?.click(); 'scored'";
                predicate = "s.teamB.score===1";
                break;
            default:
                throw new AssertionError("Unsupported sport " + sport);
        }
        evaluate(webView, script);
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && " + predicate + "); })()",
            8000,
            sport + " scoring action"
        );
    }

    private void openAndVerifyScoreboard(WebView webView, String left, String right) throws Exception {
        evaluate(webView, "document.getElementById('fullScoreboardBtn').click(); 'opened'");
        waitForJsTrue(webView,
            "!document.getElementById('fullScoreboardModal').classList.contains('hidden')",
            8000,
            "full scoreboard open"
        );
        waitForJsTrue(webView,
            "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||''; return t.includes(" + js(left) + ") && t.includes(" + js(right) + "); })()",
            10000,
            "scoreboard names " + left + " vs " + right
        );
    }

    private int rosterSize(String sport) {
        switch (sport) {
            case "volleyball": return 12;
            case "basketball": return 12;
            case "soccer": return 18;
            case "football": return 22;
            case "cricket": return 11;
            case "tennis": return 2;
            case "badminton": return 2;
            case "lacrosse": return 18;
            case "kabaddi": return 12;
            case "baseball": return 18;
            default: return 10;
        }
    }

    private String rosterText(String sport, String suffix, int count) {
        StringBuilder out = new StringBuilder();
        for (int i = 1; i <= count; i++) {
            if (i > 1) out.append("\n");
            out.append(sport.substring(0, Math.min(3, sport.length())).toUpperCase(Locale.US))
               .append("-").append(suffix).append("-Player-").append(String.format(Locale.US, "%02d", i));
        }
        return out.toString();
    }

    private String teamName(String sport, String suffix) {
        String label = sport.substring(0, 1).toUpperCase(Locale.US) + sport.substring(1);
        return label + " Team " + suffix;
    }

    private String logoDataUrl(String sport, String suffix, String color) {
        String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>" +
            "<rect width='96' height='96' rx='18' fill='" + color + "'/>" +
            "<text x='48' y='56' text-anchor='middle' font-family='sans-serif' font-size='30' font-weight='700' fill='white'>" +
            sport.substring(0,1).toUpperCase(Locale.US) + suffix + "</text></svg>";
        return "data:image/svg+xml;base64," + Base64.encodeToString(svg.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }

    private void takeScreenshot(Instrumentation instrumentation, String filename) throws Exception {
        runShell(instrumentation, "screencap -p /data/local/tmp/scorer-qc/tournament/" + filename);
    }

    private String runShell(Instrumentation instrumentation, String command) throws Exception {
        ParcelFileDescriptor pfd = instrumentation.getUiAutomation().executeShellCommand(command);
        StringBuilder out = new StringBuilder();
        try (FileInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(pfd)) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                out.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
            }
        }
        return out.toString();
    }

    private void waitForJsTrue(WebView webView, String script, long timeoutMs, String description) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        do {
            if ("true".equals(evaluate(webView, script))) return;
            SystemClock.sleep(120);
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
        assertTrue("Timed out evaluating tournament QC JavaScript", latch.await(20, TimeUnit.SECONDS));
        return result.get();
    }

    private static String js(String value) {
        String escaped = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
        return "'" + escaped + "'";
    }
}
