package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.os.SystemClock;
import android.webkit.WebView;
import android.graphics.Bitmap;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AllSportsRoundRobinQcTest {

    private static final String[][] SPORT_SPECS = {
        {"volleyball","12"}, {"basketball","12"}, {"soccer","18"}, {"football","22"}, {"cricket","15"},
        {"tennis","4"}, {"badminton","4"}, {"lacrosse","18"}, {"kabaddi","12"}, {"baseball","15"}
    };

    private static final String[][] PERMUTATIONS = {
        {"A","B"}, {"B","A"}, {"B","C"}, {"C","B"}, {"C","A"}, {"A","C"}
    };

    @Test
    public void allSportsCreatePersonasSavedTeamsRunSixGamesAndCaptureScreenshots() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc");
        assertTrue(artifactDir.mkdirs() || artifactDir.isDirectory());
        File reportFile = new File(artifactDir, "all-sports-round-robin-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("sport,persona,team_a,team_b,roster_size,screenshot,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            evaluate(webView, "localStorage.clear(); location.reload(); 'reloading'");
            waitForJsTrue(webView,
                "Boolean(document.getElementById('startGameBtn') && document.querySelector('.sport-choice[data-sport=volleyball]'))",
                20000,
                "reloaded Scorer shell"
            );
            dismissHomeIfVisible(webView);

            int screenshotIndex = 1;
            for (String[] spec : SPORT_SPECS) {
                String sport = spec[0];
                int rosterCount = Integer.parseInt(spec[1]);
                String persona = sport.substring(0,1).toUpperCase() + sport.substring(1) + " QC Operator";

                selectSport(webView, sport);
                createQcPersona(webView, sport, persona);

                saveQcTeam(webView, sport, "A", rosterCount, "#1d4ed8");
                saveQcTeam(webView, sport, "B", rosterCount, "#be123c");
                saveQcTeam(webView, sport, "C", rosterCount, "#047857");

                waitForJsTrue(webView,
                    "(() => { const f=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]').filter(x=>x.sport===" + q(sport) + ");" +
                    " return f.length===3 && f.every(x=>Boolean(x.logo) && x.roster.length===" + rosterCount + "); })()",
                    10000,
                    sport + " three saved teams with logos and full rosters"
                );

                for (String[] matchup : PERMUTATIONS) {
                    String left = matchup[0];
                    String right = matchup[1];
                    String leftName = teamName(sport, left);
                    String rightName = teamName(sport, right);

                    prepareSavedTeamMatch(webView, sport, leftName, rightName, rosterCount);
                    exerciseSport(webView, sport);

                    waitForJsTrue(webView,
                        "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
                        " return Boolean(s && s.sport===" + q(sport) +
                        " && s.teamA.name===" + q(leftName) +
                        " && s.teamB.name===" + q(rightName) +
                        " && s.teamA.roster.length===" + rosterCount +
                        " && s.teamB.roster.length===" + rosterCount +
                        " && s.teamA.logo && s.teamB.logo); })()",
                        10000,
                        sport + " " + left + " versus " + right + " persisted game state"
                    );

                    evaluate(webView, "document.getElementById('fullScoreboardBtn').click(); 'scorecard-open'");
                    waitForJsTrue(webView,
                        "(() => { const host=document.getElementById('fullScoreboardContent'); const text=host?.textContent||'';" +
                        " return Boolean(host && !document.getElementById('fullScoreboardModal').classList.contains('hidden')" +
                        " && text.includes(" + q(leftName) + ") && text.includes(" + q(rightName) + ")); })()",
                        10000,
                        sport + " " + left + " versus " + right + " full scorecard"
                    );
                    assertTrue("Share score control should remain available for " + sport,
                        "true".equals(evaluate(webView,
                            "Boolean(document.getElementById('shareScoreBtn') && !document.getElementById('shareScoreBtn').disabled)"
                        ))
                    );
                    evaluate(webView, "document.getElementById('closeFullScoreboardBtn').click(); 'scorecard-closed'");
                    SystemClock.sleep(250);

                    String fileName = String.format("%02d-%s-%s-vs-%s.png", screenshotIndex, sport, left, right);
                    captureScreenshot(new File(artifactDir, fileName));

                    report.write(csv(sport) + "," + csv(persona) + "," + csv(leftName) + "," + csv(rightName) + "," +
                        rosterCount + "," + csv(fileName) + ",PASS\n");
                    report.flush();
                    screenshotIndex += 1;
                }
            }

            waitForJsTrue(webView,
                "(() => { const p=JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}'); return Object.keys(p).length===10; })()",
                5000,
                "ten QC sport personas"
            );
            assertTrue("Expected 60 game screenshots", screenshotIndex == 61);
            File[] screenshots = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int screenshotCount = screenshots == null ? 0 : screenshots.length;
            assertTrue("Expected 60 game screenshots but found " + screenshotCount, screenshotCount == 60);
            report.flush();
            assertTrue("QC CSV manifest was not written", reportFile.isFile() && reportFile.length() > 0);
        }
    }

    private void selectSport(WebView webView, String sport) throws Exception {
        evaluate(webView,
            "document.querySelector('.sport-choice[data-sport=" + sport + "]').click(); 'selected'"
        );
        waitForJsTrue(webView,
            "document.querySelector('.sport-choice.active')?.dataset.sport===" + q(sport),
            8000,
            sport + " selection"
        );
        SystemClock.sleep(100);
    }

    private void createQcPersona(WebView webView, String sport, String persona) throws Exception {
        evaluate(webView,
            "(() => { const key='scorer-qc-personas-v1'; const p=JSON.parse(localStorage.getItem(key)||'{}');" +
            " p[" + q(sport) + "]={id:" + q("qc-" + sport) + ",name:" + q(persona) + ",sport:" + q(sport) + "};" +
            " localStorage.setItem(key,JSON.stringify(p)); return true; })()"
        );
    }

    private void saveQcTeam(WebView webView, String sport, String label, int rosterCount, String color) throws Exception {
        String name = teamName(sport, label);
        String roster = rosterText(sport, label, rosterCount);
        String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='18' fill='" +
            color + "'/><text x='48' y='58' text-anchor='middle' font-size='34' fill='white'>" +
            sport.substring(0,1).toUpperCase() + label + "</text></svg>";

        evaluate(webView,
            "(() => {" +
            " const side='A';" +
            " document.getElementById('favoriteSelectA').value='';" +
            " document.getElementById('inputNameA').value=" + q(name) + ";" +
            " document.getElementById('inputColorA').value=" + q(color) + ";" +
            " document.getElementById('inputRosterA').value=" + q(roster) + ";" +
            " const file=new File([" + q(svg) + "]," + q("qc-" + sport + "-" + label + ".svg") + ",{type:'image/svg+xml'});" +
            " const dt=new DataTransfer(); dt.items.add(file);" +
            " const input=document.getElementById('inputLogoA'); input.files=dt.files;" +
            " input.dispatchEvent(new Event('change',{bubbles:true})); return true;" +
            " })()"
        );

        waitForJsTrue(webView,
            "Boolean(document.querySelector('#logoPreviewA img')?.src.startsWith('data:image/svg+xml'))",
            8000,
            name + " logo preview"
        );

        evaluate(webView, "document.getElementById('saveFavoriteA').click(); 'saved'");
        waitForJsTrue(webView,
            "(() => { const f=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
            " const p=f.find(x=>x.sport===" + q(sport) + " && x.name===" + q(name) + ");" +
            " return Boolean(p && p.logo && p.roster.length===" + rosterCount + "); })()",
            8000,
            name + " saved favorite"
        );
    }

    private void prepareSavedTeamMatch(WebView webView, String sport, String leftName, String rightName, int rosterCount) throws Exception {
        evaluate(webView,
            "document.dispatchEvent(new CustomEvent('scorer:prepare-scheduled-game',{detail:{sport:" + q(sport) + "}})); 'prepared'"
        );
        waitForJsTrue(webView,
            "Boolean(!document.getElementById('setupModal').classList.contains('hidden')" +
            " && document.querySelector('.sport-choice.active')?.dataset.sport===" + q(sport) + ")",
            8000,
            sport + " setup ready"
        );

        evaluate(webView,
            "(() => {" +
            " const emptyA=new DataTransfer(); document.getElementById('inputLogoA').files=emptyA.files;" +
            " const emptyB=new DataTransfer(); document.getElementById('inputLogoB').files=emptyB.files;" +
            " const f=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
            " const load=(side,name)=>{ const p=f.find(x=>x.sport===" + q(sport) + " && x.name===name);" +
            " if(!p) return false; const sel=document.getElementById('favoriteSelect'+side); sel.value=p.id;" +
            " sel.dispatchEvent(new Event('change',{bubbles:true})); return true; };" +
            " return load('A'," + q(leftName) + ") && load('B'," + q(rightName) + ");" +
            " })()"
        );

        waitForJsTrue(webView,
            "(() => {" +
            " const a=document.getElementById('inputRosterA').value.split(/\\n/).filter(Boolean).length;" +
            " const b=document.getElementById('inputRosterB').value.split(/\\n/).filter(Boolean).length;" +
            " return document.getElementById('inputNameA').value===" + q(leftName) +
            " && document.getElementById('inputNameB').value===" + q(rightName) +
            " && a===" + rosterCount + " && b===" + rosterCount +
            " && document.getElementById('inputLogoA').files.length===1" +
            " && document.getElementById('inputLogoB').files.length===1" +
            " && Boolean(document.querySelector('#logoPreviewA img') && document.querySelector('#logoPreviewB img'));" +
            " })()",
            12000,
            sport + " saved teams and logo files loaded into setup"
        );
        SystemClock.sleep(500);

        evaluate(webView, "document.getElementById('startGameBtn').click(); 'started'");
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport===" + q(sport) + " && s.teamA.name===" + q(leftName) + " && s.teamB.name===" + q(rightName) + "); })()",
            10000,
            sport + " game start"
        );
    }

    private void dismissHomeIfVisible(WebView webView) throws Exception {
        SystemClock.sleep(180);
        evaluate(webView,
            "(() => {" +
            " const home=document.getElementById('v031Home');" +
            " if(home && !home.hidden && !home.classList.contains('hidden'))" +
            "   document.getElementById('v031CloseHome')?.click();" +
            " return true; })()"
        );
        waitForJsTrue(webView,
            "(() => {" +
            " const home=document.getElementById('v031Home');" +
            " if(!home) return true;" +
            " const style=getComputedStyle(home);" +
            " return Boolean(home.hidden || (home.classList.contains('hidden')" +
            " && home.getAttribute('aria-hidden')==='true' && style.display==='none')); })()",
            5000,
            "Home overlay dismissed for all-sports QC"
        );
    }

    private void exerciseSport(WebView webView, String sport) throws Exception {
        String action;
        String predicate;
        switch (sport) {
            case "volleyball":
                action = "document.querySelector('[data-action=volleyball-point][data-side=A][data-delta=\"1\"]').click();" +
                    "document.querySelector('[data-action=volleyball-point][data-side=B][data-delta=\"1\"]').click();";
                predicate = "s.teamA.score>=1 && s.teamB.score>=1";
                break;
            case "basketball":
                action = "document.querySelector('[data-action=basketball-score][data-side=A][data-delta=\"2\"]').click();" +
                    "document.querySelector('[data-action=basketball-score][data-side=B][data-delta=\"3\"]').click();";
                predicate = "s.teamA.score>=2 && s.teamB.score>=3";
                break;
            case "soccer":
                action = "document.querySelector('[data-action=soccer-goal][data-side=A][data-delta=\"1\"]').click();" +
                    "document.querySelector('[data-action=soccer-goal][data-side=B][data-delta=\"1\"]').click();";
                predicate = "s.teamA.score>=1 && s.teamB.score>=1";
                break;
            case "football":
                action = "document.querySelector('[data-action=simple][data-side=A][data-delta=\"6\"]').click();" +
                    "document.querySelector('[data-action=simple][data-side=B][data-delta=\"3\"]').click();";
                predicate = "s.teamA.score>=6 && s.teamB.score>=3";
                break;
            case "cricket":
                action = "document.querySelector('[data-action=cricket][data-value=\"1\"]').click();" +
                    "document.querySelector('[data-action=cricket][data-value=\"4\"]').click();";
                predicate = "s.teamA.balls>=2 && s.teamA.runs>=5";
                break;
            case "tennis":
                action = "document.querySelector('[data-action=tennis-point][data-side=A]').click();" +
                    "document.querySelector('[data-action=tennis-point][data-side=B]').click();";
                predicate = "s.tennis.points.A>=1 && s.tennis.points.B>=1";
                break;
            case "badminton":
                action = "document.querySelector('[data-action=badminton-point][data-side=A]').click();" +
                    "document.querySelector('[data-action=badminton-point][data-side=B]').click();";
                predicate = "s.badminton.points.A>=1 && s.badminton.points.B>=1";
                break;
            case "lacrosse":
                action = "document.querySelector('[data-action=lacrosse-goal][data-side=A][data-delta=\"1\"]').click();" +
                    "document.querySelector('[data-action=lacrosse-goal][data-side=B][data-delta=\"1\"]').click();";
                predicate = "s.teamA.score>=1 && s.teamB.score>=1";
                break;
            case "kabaddi":
                action = "document.querySelector('#sportTools [data-action=kabaddi-technical][data-side=A]').click();" +
                    "document.querySelector('#sportTools [data-action=kabaddi-technical][data-side=B]').click();";
                predicate = "s.teamA.score>=1 && s.teamB.score>=1";
                break;
            case "baseball":
                action = "document.querySelector('#gameSurface [data-action=baseball-run][data-delta=\"1\"]').click();" +
                    "document.querySelector('#gameSurface [data-action=baseball-run][data-delta=\"1\"]').click();";
                predicate = "s[s.baseball.battingTeam==='A'?'teamA':'teamB'].score>=2";
                break;
            default:
                throw new IllegalArgumentException("Unsupported sport " + sport);
        }

        evaluate(webView, action + "'scored'");
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && " + predicate + "); })()",
            10000,
            sport + " live scoring"
        );
    }

    private void captureScreenshot(File file) throws Exception {
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("Android QC screenshot capture returned null", bitmap);
        boolean compressed;
        try (FileOutputStream out = new FileOutputStream(file, false)) {
            compressed = bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            out.flush();
        } finally {
            bitmap.recycle();
        }
        assertTrue("Screenshot PNG compression failed for " + file.getName(), compressed);
        assertTrue("Screenshot was not written " + file.getName(), file.isFile() && file.length() > 0);
    }

    private String teamName(String sport, String label) {
        return sport.substring(0,1).toUpperCase() + sport.substring(1) + " QC " + label;
    }

    private String rosterText(String sport, String label, int count) {
        StringBuilder out = new StringBuilder();
        for (int i = 1; i <= count; i++) {
            if (i > 1) out.append("\n");
            out.append(sport.toUpperCase()).append("-").append(label).append("-").append(String.format("%02d", i));
        }
        return out.toString();
    }

    private String csv(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String q(String value) {
        return "'" + value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\r", "\\r")
            .replace("\n", "\\n") + "'";
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
        assertTrue("Timed out evaluating all-sports QC JavaScript", latch.await(20, TimeUnit.SECONDS));
        return result.get();
    }
}
