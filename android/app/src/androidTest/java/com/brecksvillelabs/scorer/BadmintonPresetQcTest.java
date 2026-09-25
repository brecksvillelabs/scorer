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
public class BadmintonPresetQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "badminton";
    private static final String PERSONA = "Badminton QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie Racquets", "#1d4ed8", "LER", new String[] {
            "Ava Patel", "Maya Chen", "Sofia Ramirez", "Priya Nair"
        }),
        new TeamFixture("B", "Cuyahoga Shuttlers", "#be123c", "CS", new String[] {
            "Olivia Brown", "Aisha Khan", "Grace Lee", "Camila Rodriguez"
        }),
        new TeamFixture("C", "Brecksville Smash", "#047857", "BS", new String[] {
            "Ella Nguyen", "Saanvi Iyer", "Aria Miller", "Rhea Singh"
        })
    };

    private static final int[][] ROUND_ROBIN = {
        {0,1}, {1,0}, {1,2}, {2,1}, {2,0}, {0,2}
    };

    @Test
    public void badmintonExercisesPresetsAndCompletesRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/badminton-reference");
        resetArtifactDirectory(artifactDir);
        resetPublishedArtifactDirectory("badminton-reference");
        File reportFile = new File(artifactDir, "badminton-qc-report.csv");

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

            // 1) BAI/BWF classic 3x21 — full three-game singles match.
            TeamFixture left = TEAMS[0], right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "bai-3x21", "simple", "singles", 3, 21, 2, 30);
            captureScreenshot(new File(artifactDir, "01-badminton-bai-3x21-setup.png")); screenshots++;
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "bai-3x21", 3, 21, 2, 30, "singles");
            waitForHero(webView, left, right, 0, 0, "BAI / BWF", false);
            captureScreenshot(new File(artifactDir, "02-badminton-bai-3x21-live.png")); screenshots++;
            playGame(webView, "A", 21, "B", 17);
            playGame(webView, "B", 21, "A", 18);
            playGame(webView, "A", 22, "B", 20);
            waitForFinal(webView, "bai-3x21", "A", 3, 2, 1, 22, 20);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecardPreset(webView, "BAI / BWF 3×21", "22", "20");
            captureScreenshot(new File(artifactDir, "03-badminton-bai-3x21-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 1, "bai-3x21", left, right, "best of 3 to 21; win by 2; cap 30", "A won 2-1; 21-17, 18-21, 22-20",
                "01-badminton-bai-3x21-setup.png;02-badminton-bai-3x21-live.png;03-badminton-bai-3x21-final.png");

            // 2) India short 3x15 — full three-game match with a 17-15 decider.
            left = TEAMS[1]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "india-3x15", "simple", "singles", 3, 15, 2, 21);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "india-3x15", 3, 15, 2, 21, "singles");
            waitForHero(webView, left, right, 0, 0, "India short", false);
            captureScreenshot(new File(artifactDir, "04-badminton-india-3x15-live.png")); screenshots++;
            playGame(webView, "A", 15, "B", 11);
            playGame(webView, "B", 15, "A", 13);
            playGame(webView, "A", 17, "B", 15);
            waitForFinal(webView, "india-3x15", "A", 3, 2, 1, 17, 15);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecardPreset(webView, "India short 3×15", "17", "15");
            captureScreenshot(new File(artifactDir, "05-badminton-india-3x15-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 2, "india-3x15", left, right, "best of 3 to 15; win by 2; cap 21", "A won 2-1; 15-11, 13-15, 17-15",
                "04-badminton-india-3x15-live.png;05-badminton-india-3x15-final.png");

            // 3) Quick 1x21.
            left = TEAMS[1]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "quick-1x21", "simple", "singles", 1, 21, 2, 30);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "quick-1x21", 1, 21, 2, 30, "singles");
            playGame(webView, "A", 21, "B", 18);
            waitForFinal(webView, "quick-1x21", "A", 1, 1, 0, 21, 18);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecardPreset(webView, "Quick 1×21", "21", "18");
            captureScreenshot(new File(artifactDir, "06-badminton-quick-1x21-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 3, "quick-1x21", left, right, "1 game to 21; win by 2; cap 30", "A won 21-18",
                "06-badminton-quick-1x21-final.png");

            // 4) Club quick 1x15 in detailed doubles view.
            left = TEAMS[2]; right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "club-1x15", "advanced", "doubles", 1, 15, 2, 21);
            startMatch(webView, SPORT, left, right);
            waitForPresetState(webView, "club-1x15", 1, 15, 2, 21, "doubles");
            rally(webView, "A", 6);
            rally(webView, "B", 8);
            waitForHero(webView, left, right, 6, 8, "Club quick", false);
            waitForJsTrue(webView,
                "(() => { const t=document.getElementById('gameSurface')?.textContent||'';" +
                " return t.includes('SERVING') && (t.includes('Right court') || t.includes('Left court'))" +
                " && t.includes(" + q(left.roster[0]) + ") && t.includes(" + q(left.roster[1]) + "); })()",
                5000,
                "Badminton detailed doubles service context"
            );
            captureScreenshot(new File(artifactDir, "07-badminton-club-1x15-doubles-live.png")); screenshots++;
            rally(webView, "A", 6); // 12-8
            rally(webView, "B", 7); // B wins 15-12
            waitForFinal(webView, "club-1x15", "B", 1, 0, 1, 12, 15);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            assertScorecardPreset(webView, "Club quick 1×15", "12", "15");
            captureScreenshot(new File(artifactDir, "08-badminton-club-1x15-doubles-final.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 4, "club-1x15", left, right, "1 game to 15; doubles; detailed service view", "B won 15-12",
                "07-badminton-club-1x15-doubles-live.png;08-badminton-club-1x15-doubles-final.png");

            // 5) Complete C -> A permutation with quick 1x21.
            left = TEAMS[2]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "quick-1x21", "simple", "singles", 1, 21, 2, 30);
            startMatch(webView, SPORT, left, right);
            playGame(webView, "A", 21, "B", 16);
            waitForFinal(webView, "quick-1x21", "A", 1, 1, 0, 21, 16);
            waitForHero(webView, left, right, 21, 16, "Quick", true);
            captureScreenshot(new File(artifactDir, "09-badminton-c-vs-a-final.png")); screenshots++;
            reportGame(report, 5, "quick-1x21", left, right, "1 game to 21", "A won 21-16",
                "09-badminton-c-vs-a-final.png");

            // 6) Complete A -> C permutation with a straight-games India short match.
            left = TEAMS[0]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setPreset(webView, "india-3x15", "simple", "singles", 3, 15, 2, 21);
            startMatch(webView, SPORT, left, right);
            playGame(webView, "A", 15, "B", 10);
            playGame(webView, "A", 15, "B", 9);
            waitForFinal(webView, "india-3x15", "A", 2, 2, 0, 15, 9);
            waitForHero(webView, left, right, 15, 9, "India short", true);
            captureScreenshot(new File(artifactDir, "10-badminton-a-vs-c-final.png")); screenshots++;
            reportGame(report, 6, "india-3x15", left, right, "best of 3 to 15", "A won 2-0; 15-10, 15-9",
                "10-badminton-a-vs-c-final.png");

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').badminton?.name===" + q(PERSONA),
                5000,
                "Badminton QC persona retained"
            );

            File[] pngs = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = pngs == null ? 0 : pngs.length;
            assertTrue("Expected 10 Badminton QC screenshots but found " + actualScreenshots, actualScreenshots == 10);
            assertTrue("Internal Badminton screenshot counter mismatch", screenshots == 10);
            report.flush();
            assertTrue("Badminton QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
            publishArtifact(reportFile, "badminton-reference");
        }
    }

    private void setPreset(WebView webView, String preset, String tracking, String matchType,
                           int bestOf, int gameTo, int winBy, int cap) throws Exception {
        evaluate(webView,
            "(() => {" +
            " const p=document.getElementById('settingBadmintonPreset'); p.value=" + q(preset) + ";" +
            " p.dispatchEvent(new Event('change',{bubbles:true}));" +
            " document.getElementById('settingTrackingMode').value=" + q(tracking) + ";" +
            " document.getElementById('settingBadmintonMatchType').value=" + q(matchType) + ";" +
            " document.getElementById('settingBadmintonBestOf').value=" + q(String.valueOf(bestOf)) + ";" +
            " document.getElementById('settingBadmintonGameTo').value=" + q(String.valueOf(gameTo)) + ";" +
            " document.getElementById('settingBadmintonWinBy').value=" + q(String.valueOf(winBy)) + ";" +
            " document.getElementById('settingBadmintonCap').value=" + q(String.valueOf(cap)) + "; return true; })()"
        );
        waitForJsTrue(webView,
            "(() => document.getElementById('settingBadmintonPreset').value===" + q(preset) +
            " && document.getElementById('settingBadmintonBestOf').value===" + q(String.valueOf(bestOf)) +
            " && document.getElementById('settingBadmintonGameTo').value===" + q(String.valueOf(gameTo)) +
            " && document.getElementById('settingBadmintonCap').value===" + q(String.valueOf(cap)) + ")()",
            4000,
            "Badminton preset " + preset + " in setup"
        );
    }

    private void waitForPresetState(WebView webView, String preset, int bestOf, int gameTo,
                                    int winBy, int cap, String matchType) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " const b=s?.badminton; return Boolean(s && s.sport==='badminton' && b" +
            " && b.preset===" + q(preset) + " && b.bestOf===" + bestOf +
            " && b.gameTo===" + gameTo + " && b.winBy===" + winBy + " && b.cap===" + cap +
            " && b.matchType===" + q(matchType) + "); })()",
            6000,
            "Badminton persisted preset " + preset
        );
    }

    private void rally(WebView webView, String side, int count) throws Exception {
        assertTrue("Could not score Badminton rallies for side " + side,
            "true".equals(evaluate(webView,
                "(() => { for(let i=0;i<" + count + ";i++){" +
                " const b=document.querySelector('[data-action=badminton-point][data-side=" + side + "]');" +
                " if(!b)return false; b.click(); } return true; })()"
            ))
        );
    }

    private void playGame(WebView webView, String winner, int winnerPoints, String loser, int loserPoints) throws Exception {
        rally(webView, loser, loserPoints);
        rally(webView, winner, winnerPoints);
        SystemClock.sleep(250);
    }

    private void waitForHero(WebView webView, TeamFixture left, TeamFixture right,
                             int pointsA, int pointsB, String presetText, boolean finished) throws Exception {
        waitForJsTrue(webView,
            "(() => {" +
            " const h=document.querySelector('.badminton-score-hero'); if(!h)return false;" +
            " const a=h.querySelector('[data-badminton-hero-team=A]');" +
            " const b=h.querySelector('[data-badminton-hero-team=B]');" +
            " const sa=h.querySelector('[data-badminton-hero-score=A]');" +
            " const sb=h.querySelector('[data-badminton-hero-score=B]');" +
            " const r=h.getBoundingClientRect(); const text=h.textContent||'';" +
            " return Boolean(getComputedStyle(h).display!=='none' && r.top>=0 && r.bottom<=window.innerHeight" +
            " && a?.textContent.includes(" + q(left.name) + ") && b?.textContent.includes(" + q(right.name) + ")" +
            " && sa?.textContent.trim()===" + q(String.valueOf(pointsA)) +
            " && sb?.textContent.trim()===" + q(String.valueOf(pointsB)) +
            " && text.includes(" + q(presetText) + ")" +
            " && " + (finished ? "text.includes('FINAL')" : "!text.includes('FINAL')") + "); })()",
            7000,
            "Badminton dual-team hero " + presetText + " " + pointsA + "-" + pointsB
        );
        assertNoBlockingNavigation(webView, "Badminton " + presetText + " hero");
        SystemClock.sleep(450);
    }

    private void waitForFinal(WebView webView, String preset, String winner, int historyCount,
                              int gamesA, int gamesB, int finalA, int finalB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); const b=s?.badminton;" +
            " const last=b?.gameHistory?.[b.gameHistory.length-1];" +
            " return Boolean(s && s.finished===true && s.winner===" + q(winner) +
            " && b?.preset===" + q(preset) + " && b.gameHistory.length===" + historyCount +
            " && b.games.A===" + gamesA + " && b.games.B===" + gamesB +
            " && last?.scoreA===" + finalA + " && last?.scoreB===" + finalB + "); })()",
            10000,
            "Badminton final " + preset
        );
    }

    private void assertScorecardPreset(WebView webView, String presetLabel, String finalA, String finalB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||'';" +
            " return t.includes(" + q(presetLabel) + ") && t.includes('Game matrix')" +
            " && t.includes(" + q(finalA) + ") && t.includes(" + q(finalB) + "); })()",
            6000,
            "Badminton full scorecard " + presetLabel
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
