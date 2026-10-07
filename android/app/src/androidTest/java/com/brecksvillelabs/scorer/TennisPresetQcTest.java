package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.os.SystemClock;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TennisPresetQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "tennis";
    private static final String PERSONA = "Tennis QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie Aces", "#1d4ed8", "LEA", new String[] {
            "Ava Patel", "Maya Chen", "Sofia Ramirez", "Priya Nair"
        }),
        new TeamFixture("B", "Cuyahoga Baseliners", "#be123c", "CB", new String[] {
            "Olivia Brown", "Aisha Khan", "Grace Lee", "Camila Rodriguez"
        }),
        new TeamFixture("C", "Brecksville Ralliers", "#047857", "BR", new String[] {
            "Ella Nguyen", "Saanvi Iyer", "Aria Miller", "Rhea Singh"
        })
    };

    @Test
    public void tennisExercisesPresetsAndCompletesRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/tennis-reference");
        resetArtifactDirectory(artifactDir);
        resetPublishedArtifactDirectory("tennis-reference");
        File reportFile = new File(artifactDir, "tennis-qc-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);
            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("type,sequence,persona,preset,team_a,team_b,format,result,screenshots,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            cleanPriorQcData(webView, SPORT, TEAMS);
            selectSport(webView, SPORT);
            createQcPersona(webView, SPORT, PERSONA);

            for (TeamFixture team : TEAMS) {
                saveTeam(webView, SPORT, team);
                report.write("team,," + csv(PERSONA) + ",," + csv(team.name) + ",," +
                    csv("4-player singles/doubles-ready roster") + ",,," + "PASS\n");
                report.flush();
            }
            assertSavedTeams(webView, SPORT, TEAMS);

            int screenshots = 0;

            // 1) Standard best-of-3: deuce/advantage plus a deciding-set tie-break.
            TeamFixture left = TEAMS[0], right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "standard-3", "simple", "singles", 3, false, 0);
            showFormatForSetupScreenshot(webView, "standard-3", left, right);
            captureScreenshot(new File(artifactDir, "01-tennis-standard-3-setup.png")); screenshots++;
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "standard-3", 3, false, 0, "singles");

            point(webView, "A", 3);
            point(webView, "B", 3);
            waitForHero(webView, left, right, "40", "40", 0, 0, "Standard", false);
            captureScreenshot(new File(artifactDir, "02-tennis-standard-deuce-live.png")); screenshots++;
            point(webView, "A", 2); // A takes the deuce game.
            playSetFromGames(webView, "A", "B", 6, 4, 1, 0);
            playSet(webView, "B", "A", 6, 3);
            playTieBreakSet(webView, "A", "B", 8, 6);
            waitForFinal(webView, "standard-3", "A", 3, 2, 1);
            waitForHero(webView, left, right, "7", "6", 7, 6, "Standard", true);
            waitForJsTrue(webView,
                "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return s?.tennis?.setHistory?.at(-1)?.tiebreak==='8-6'; })()",
                5000,
                "Tennis deciding-set tie-break 8-6"
            );
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecard(webView, "Standard best of 3", "(6)");
            captureScreenshot(new File(artifactDir, "03-tennis-standard-tiebreak-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 1, "standard-3", left, right,
                "best of 3; advantage scoring; 7-point set tie-break",
                "A won 2-1; deciding set 7-6 (TB 8-6)",
                "01-tennis-standard-3-setup.png;02-tennis-standard-deuce-live.png;03-tennis-standard-tiebreak-final.png");

            // 2) No-Ad best-of-3: explicitly stop at the deciding point.
            left = TEAMS[1]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "no-ad-3", "simple", "singles", 3, true, 0);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "no-ad-3", 3, true, 0, "singles");
            point(webView, "A", 3);
            point(webView, "B", 3);
            waitForHero(webView, left, right, "40", "40", 0, 0, "No-Ad", false);
            waitForJsTrue(webView,
                "document.getElementById('gameSurface')?.textContent.includes('deciding point')===true",
                4000,
                "Tennis No-Ad deciding point banner"
            );
            captureScreenshot(new File(artifactDir, "04-tennis-no-ad-deciding-point.png")); screenshots++;
            point(webView, "A", 1);
            playSetFromGames(webView, "A", "B", 6, 2, 1, 0);
            playSet(webView, "A", "B", 6, 4);
            waitForFinal(webView, "no-ad-3", "A", 2, 2, 0);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecard(webView, "No-Ad best of 3", "No-Ad");
            captureScreenshot(new File(artifactDir, "05-tennis-no-ad-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 2, "no-ad-3", left, right,
                "best of 3; No-Ad deciding point",
                "A won 2-0",
                "04-tennis-no-ad-deciding-point.png;05-tennis-no-ad-final.png");

            // 3) Doubles: No-Ad sets followed by a deciding match tie-break to 10.
            left = TEAMS[1]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "doubles-10", "advanced", "doubles", 3, true, 10);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "doubles-10", 3, true, 10, "doubles");
            playSet(webView, "A", "B", 6, 3);
            playSet(webView, "B", "A", 6, 4);
            waitForJsTrue(webView,
                "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s?.tennis?.matchTiebreak && s.period===3); })()",
                6000,
                "Tennis deciding match tie-break"
            );
            point(webView, "A", 6);
            point(webView, "B", 6);
            waitForHero(webView, left, right, "6", "6", 1, 1, "Doubles", false);
            waitForJsTrue(webView,
                "(() => { const t=document.getElementById('gameSurface')?.textContent||''; return t.includes(" + q(left.roster[0]) + ") && t.includes(" + q(left.roster[1]) + ") && t.includes('MATCH TIE-BREAK'); })()",
                5000,
                "Tennis doubles pair and match tie-break hero"
            );
            captureScreenshot(new File(artifactDir, "06-tennis-doubles-match-tiebreak-live.png")); screenshots++;
            point(webView, "B", 2);
            point(webView, "A", 4);
            waitForFinal(webView, "doubles-10", "A", 3, 2, 1);
            waitForHero(webView, left, right, "10", "8", 0, 0, "Doubles", true);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecard(webView, "Doubles match tie-break 10", "MTB");
            captureScreenshot(new File(artifactDir, "07-tennis-doubles-match-tiebreak-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 3, "doubles-10", left, right,
                "No-Ad doubles; deciding match tie-break to 10",
                "A won 2-1; MTB 10-8",
                "06-tennis-doubles-match-tiebreak-live.png;07-tennis-doubles-match-tiebreak-final.png");

            // 4) Standard best-of-5.
            left = TEAMS[2]; right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "standard-5", "simple", "singles", 5, false, 0);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "standard-5", 5, false, 0, "singles");
            playSet(webView, "A", "B", 6, 1);
            playSet(webView, "A", "B", 6, 2);
            playSet(webView, "A", "B", 6, 0);
            waitForFinal(webView, "standard-5", "A", 3, 3, 0);
            waitForHero(webView, left, right, "6", "0", 6, 0, "Standard", true);
            captureScreenshot(new File(artifactDir, "08-tennis-standard-5-final.png")); screenshots++;
            reportGame(report, 4, "standard-5", left, right,
                "best of 5; advantage scoring",
                "A won 3-0",
                "08-tennis-standard-5-final.png");

            // 5) Complete C -> A permutation.
            left = TEAMS[2]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "standard-3", "simple", "singles", 3, false, 0);
            startMatch(webView, SPORT, left, right);
            playSet(webView, "A", "B", 6, 1);
            playSet(webView, "A", "B", 6, 1);
            waitForFinal(webView, "standard-3", "A", 2, 2, 0);
            captureScreenshot(new File(artifactDir, "09-tennis-c-vs-a-final.png")); screenshots++;
            reportGame(report, 5, "standard-3", left, right,
                "best of 3; advantage scoring",
                "A won 2-0",
                "09-tennis-c-vs-a-final.png");

            // 6) Complete A -> C permutation.
            left = TEAMS[0]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "no-ad-3", "simple", "doubles", 3, true, 0);
            startMatch(webView, SPORT, left, right);
            playSet(webView, "B", "A", 6, 2);
            playSet(webView, "B", "A", 6, 4);
            waitForFinal(webView, "no-ad-3", "B", 2, 0, 2);
            captureScreenshot(new File(artifactDir, "10-tennis-a-vs-c-final.png")); screenshots++;
            reportGame(report, 6, "no-ad-3", left, right,
                "best of 3; No-Ad; doubles display",
                "B won 2-0",
                "10-tennis-a-vs-c-final.png");

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').tennis?.name===" + q(PERSONA),
                5000,
                "Tennis QC persona retained"
            );

            File[] pngs = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = pngs == null ? 0 : pngs.length;
            assertTrue("Expected 10 Tennis QC screenshots but found " + actualScreenshots, actualScreenshots == 10);
            assertTrue("Internal Tennis screenshot counter mismatch", screenshots == 10);
            report.flush();
            assertTrue("Tennis QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
            publishArtifact(reportFile, "tennis-reference");
        }
    }

    private void showFormatForSetupScreenshot(WebView webView, String preset,
                                              TeamFixture left, TeamFixture right) throws Exception {
        evaluate(webView,
            "(() => {" +
            " const modal=document.getElementById('setupModal');" +
            " if(modal?.dataset?.v039Step==='teams') document.getElementById('v039NextBtn')?.click();" +
            " return true; })()"
        );
        waitForJsTrue(webView,
            "(() => {" +
            " const modal=document.getElementById('setupModal');" +
            " const card=document.querySelector('[data-v039-preset=" + preset + "]');" +
            " const a=document.getElementById('inputNameA')?.value;" +
            " const b=document.getElementById('inputNameB')?.value;" +
            " return Boolean(modal?.dataset?.v039Step==='format' && card?.getAttribute('aria-pressed')==='true'" +
            " && a===" + q(left.name) + " && b===" + q(right.name) + "); })()",
            6000,
            "Tennis Quick Start format screenshot " + preset
        );
        SystemClock.sleep(350);
    }

    private void setPreset(WebView webView, String preset, String tracking, String matchType,
                           int bestOf, boolean noAd, int decider) throws Exception {
        evaluate(webView,
            "(() => {" +
            " const p=document.getElementById('settingTennisPreset'); p.value=" + q(preset) + ";" +
            " p.dispatchEvent(new Event('change',{bubbles:true}));" +
            " document.getElementById('settingTrackingMode').value=" + q(tracking) + ";" +
            " document.getElementById('settingTennisMatchType').value=" + q(matchType) + ";" +
            " document.getElementById('settingTennisBestOf').value=" + q(String.valueOf(bestOf)) + ";" +
            " document.getElementById('settingTennisNoAd').value=" + q(noAd ? "true" : "false") + ";" +
            " document.getElementById('settingTennisDecider').value=" + q(String.valueOf(decider)) + "; return true; })()"
        );
    }

    private void waitForPresetState(WebView webView, String preset, int bestOf, boolean noAd,
                                    int decider, String matchType) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); const t=s?.tennis;" +
            " return Boolean(s && s.sport==='tennis' && t && t.preset===" + q(preset) +
            " && t.bestOf===" + bestOf + " && t.noAd===" + noAd +
            " && t.decidingMatchTiebreakTo===" + decider +
            " && t.matchType===" + q(matchType) + "); })()",
            6000,
            "Tennis persisted preset " + preset
        );
    }

    private void point(WebView webView, String side, int count) throws Exception {
        assertTrue("Could not score Tennis points for side " + side,
            "true".equals(evaluate(webView,
                "(() => { for(let i=0;i<" + count + ";i++){" +
                " const b=document.querySelector('[data-action=tennis-point][data-side=" + side + "]');" +
                " if(!b)return false; b.click(); } return true; })()"
            ))
        );
    }

    private void winGame(WebView webView, String side) throws Exception {
        point(webView, side, 4);
    }

    private void playSet(WebView webView, String winner, String loser, int winnerGames, int loserGames) throws Exception {
        for (int i = 0; i < loserGames; i++) winGame(webView, loser);
        for (int i = 0; i < winnerGames; i++) winGame(webView, winner);
        SystemClock.sleep(250);
    }

    private void playSetFromGames(WebView webView, String winner, String loser,
                                  int winnerGames, int loserGames,
                                  int currentWinnerGames, int currentLoserGames) throws Exception {
        for (int i = currentLoserGames; i < loserGames; i++) winGame(webView, loser);
        for (int i = currentWinnerGames; i < winnerGames; i++) winGame(webView, winner);
        SystemClock.sleep(250);
    }

    private void playTieBreakSet(WebView webView, String winner, String loser,
                                 int winnerTbPoints, int loserTbPoints) throws Exception {
        for (int game = 0; game < 6; game++) {
            winGame(webView, winner);
            winGame(webView, loser);
        }
        point(webView, loser, loserTbPoints);
        point(webView, winner, winnerTbPoints);
        SystemClock.sleep(250);
    }

    private void waitForHero(WebView webView, TeamFixture left, TeamFixture right,
                             String pointA, String pointB, int gamesA, int gamesB,
                             String presetText, boolean finished) throws Exception {
        String scoreContext = finished
            ? " && !h.querySelector('[data-tennis-hero-games=A]')" +
              " && !h.querySelector('[data-tennis-hero-games=B]')" +
              " && (text.includes('FINAL SET') || text.includes('MATCH TB'))" +
              " && !document.querySelector('[data-action=tennis-point]')"
            : " && ga?.textContent.trim()===" + q(String.valueOf(gamesA)) +
              " && gb?.textContent.trim()===" + q(String.valueOf(gamesB));

        waitForJsTrue(webView,
            "(() => {" +
            " const h=document.querySelector('.tennis-score-hero'); if(!h)return false;" +
            " const a=h.querySelector('[data-tennis-hero-team=A]'); const b=h.querySelector('[data-tennis-hero-team=B]');" +
            " const pa=h.querySelector('[data-tennis-hero-point=A]'); const pb=h.querySelector('[data-tennis-hero-point=B]');" +
            " const ga=h.querySelector('[data-tennis-hero-games=A]'); const gb=h.querySelector('[data-tennis-hero-games=B]');" +
            " const r=h.getBoundingClientRect(); const text=h.textContent||'';" +
            " return Boolean(getComputedStyle(h).display!=='none' && r.top>=0 && r.bottom<=window.innerHeight" +
            " && a?.textContent.includes(" + q(left.name) + ") && b?.textContent.includes(" + q(right.name) + ")" +
            " && pa?.textContent.trim()===" + q(pointA) + " && pb?.textContent.trim()===" + q(pointB) +
            scoreContext +
            " && text.includes(" + q(presetText) + ")" +
            " && " + (finished ? "text.includes('FINAL')" : "!text.includes('FINAL')") + "); })()",
            7000,
            "Tennis dual-player hero " + presetText
        );
        assertNoBlockingNavigation(webView, "Tennis " + presetText + " hero");
        SystemClock.sleep(400);
    }

    private void waitForFinal(WebView webView, String preset, String winner, int historyCount,
                              int setsA, int setsB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); const t=s?.tennis;" +
            " return Boolean(s && s.finished===true && s.winner===" + q(winner) +
            " && t?.preset===" + q(preset) + " && t.setHistory.length===" + historyCount +
            " && t.sets.A===" + setsA + " && t.sets.B===" + setsB + "); })()",
            10000,
            "Tennis final " + preset
        );
    }

    private void assertScorecard(WebView webView, String presetLabel, String extra) throws Exception {
        waitForJsTrue(webView,
            "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||'';" +
            " return t.includes(" + q(presetLabel) + ") && t.includes('Set matrix') && t.includes(" + q(extra) + "); })()",
            6000,
            "Tennis full scorecard " + presetLabel
        );
    }

    private void reportGame(BufferedWriter report, int sequence, String preset,
                            TeamFixture left, TeamFixture right, String format,
                            String result, String screenshots) throws Exception {
        report.write("game," + sequence + "," + csv(PERSONA) + "," + csv(preset) + "," +
            csv(left.name) + "," + csv(right.name) + "," + csv(format) + "," +
            csv(result) + "," + csv(screenshots) + ",PASS\n");
        report.flush();
    }
}
