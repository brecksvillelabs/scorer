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
public class VolleyballRoundRobinQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "volleyball";
    private static final String PERSONA = "Volleyball QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie Lightning", "#1d4ed8", "LEL", new String[] {
            "Ava Patel", "Maya Chen", "Sofia Ramirez", "Emma Johnson",
            "Priya Nair", "Layla Hassan", "Chloe Martin", "Isabella Garcia",
            "Zoe Williams", "Ananya Rao", "Mia Thompson", "Naomi Kim"
        }),
        new TeamFixture("B", "Cleveland Comets", "#be123c", "CC", new String[] {
            "Olivia Brown", "Aisha Khan", "Grace Lee", "Camila Rodriguez",
            "Nora Davis", "Isha Mehta", "Hannah Wilson", "Elena Petrova",
            "Leila Ahmed", "Ruby Anderson", "Keira Murphy", "Amara Okafor"
        }),
        new TeamFixture("C", "Brecksville Blaze", "#047857", "BB", new String[] {
            "Ella Nguyen", "Saanvi Iyer", "Aria Miller", "Lucia Santos",
            "Sarah Cohen", "Nila Krishnan", "Gianna Rossi", "Fatima Ali",
            "Audrey Clark", "Rhea Singh", "Tessa Walker", "Daniela Lopez"
        })
    };

    private static final int[][] ROUND_ROBIN = {
        {0,1}, {1,0}, {1,2}, {2,1}, {2,0}, {0,2}
    };

    @Test
    public void volleyballCreatesTeamsReloadsLogosAndCompletesRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/volleyball-reference");
        resetArtifactDirectory(artifactDir);
        File reportFile = new File(artifactDir, "volleyball-qc-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("type,sequence,persona,team_a,team_b,roster_a,roster_b,result,screenshots,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            cleanPriorQcData(webView, SPORT, TEAMS);
            selectSport(webView, SPORT);
            createQcPersona(webView, SPORT, PERSONA);

            for (TeamFixture team : TEAMS) {
                saveTeam(webView, SPORT, team);
                report.write("team,," + csv(PERSONA) + "," + csv(team.name) + ",," +
                    team.rosterSize() + ",," + csv("saved with logo") + ",,PASS\n");
                report.flush();
            }
            assertSavedTeams(webView, SPORT, TEAMS);

            int screenshotCount = 0;
            for (int game = 0; game < ROUND_ROBIN.length; game++) {
                TeamFixture left = TEAMS[ROUND_ROBIN[game][0]];
                TeamFixture right = TEAMS[ROUND_ROBIN[game][1]];
                String screenshots;

                loadSavedTeamsIntoSetup(webView, SPORT, left, right);
                setReferenceMatchFormat(webView);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "01-volleyball-team-setup.png"));
                    screenshotCount++;
                }

                startMatch(webView, SPORT, left, right);
                waitForReferenceMatchFormat(webView);

                if (game == 0) {
                    scorePoints(webView, "B", 5);
                    scorePoints(webView, "A", 7);
                    waitForScore(webView, 7, 5);
                    captureScreenshot(new File(artifactDir, "02-volleyball-live-7-5.png"));
                    screenshotCount++;

                    finishCurrentSet(webView, 18, 25, 5, 7, 1);
                    finishFreshSet(webView, 20, 25, 2);
                    finishFreshSet(webView, 22, 25, 3);
                } else {
                    finishFreshSet(webView, 18, 25, 1);
                    finishFreshSet(webView, 20, 25, 2);
                    finishFreshSet(webView, 22, 25, 3);
                }

                waitForMatchFinal(webView, left, right);
                openAndValidateFullScoreboard(webView, SPORT, left, right);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "03-volleyball-final-scoreboard.png"));
                    screenshotCount++;
                    screenshots = "01-volleyball-team-setup.png;02-volleyball-live-7-5.png;03-volleyball-final-scoreboard.png";
                } else {
                    screenshots = String.format("%02d-volleyball-%s-vs-%s-final.png",
                        game + 3, slug(left.label), slug(right.label));
                }

                closeFullScoreboard(webView);

                if (game > 0) {
                    captureScreenshot(new File(artifactDir, screenshots));
                    screenshotCount++;
                }

                report.write("game," + (game + 1) + "," + csv(PERSONA) + "," + csv(left.name) + "," + csv(right.name) + "," +
                    left.rosterSize() + "," + right.rosterSize() + "," + csv(left.name + " won 3-0") + "," +
                    csv(screenshots) + ",PASS\n");
                report.flush();
            }

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').volleyball?.name===" + q(PERSONA),
                5000,
                "Volleyball QC persona retained"
            );

            File[] screenshots = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = screenshots == null ? 0 : screenshots.length;
            assertTrue("Expected 8 Volleyball QC screenshots but found " + actualScreenshots, actualScreenshots == 8);
            assertTrue("Internal Volleyball screenshot counter mismatch", screenshotCount == 8);
            report.flush();
            assertTrue("Volleyball QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
        }
    }


    private void setReferenceMatchFormat(WebView webView) throws Exception {
        evaluate(webView,
            "(() => {" +
            " document.getElementById('settingBestOf').value='5';" +
            " document.getElementById('settingSetTo').value='25';" +
            " document.getElementById('settingDecidingSetTo').value='15';" +
            " document.getElementById('settingWinBy').value='2';" +
            " return true; })()"
        );
        waitForJsTrue(webView,
            "document.getElementById('settingBestOf').value==='5'" +
            " && document.getElementById('settingSetTo').value==='25'" +
            " && document.getElementById('settingDecidingSetTo').value==='15'" +
            " && document.getElementById('settingWinBy').value==='2'",
            3000,
            "Volleyball reference match format in setup"
        );
    }

    private void waitForReferenceMatchFormat(WebView webView) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.volleyball?.bestOf===5 && s.volleyball?.setTo===25" +
            " && s.volleyball?.decidingSetTo===15 && s.volleyball?.winBy===2); })()",
            5000,
            "Volleyball best-of-5 reference match format"
        );
    }

    private void finishCurrentSet(WebView webView, int loserTarget, int winnerTarget,
                                  int currentLoser, int currentWinner, int expectedSets) throws Exception {
        scorePoints(webView, "B", loserTarget - currentLoser);
        scorePoints(webView, "A", winnerTarget - currentWinner);
        waitForSets(webView, expectedSets);
    }

    private void finishFreshSet(WebView webView, int loserPoints, int winnerPoints, int expectedSets) throws Exception {
        scorePoints(webView, "B", loserPoints);
        scorePoints(webView, "A", winnerPoints);
        waitForSets(webView, expectedSets);
    }

    private void scorePoints(WebView webView, String side, int count) throws Exception {
        String selector = "[data-action=volleyball-point][data-side=" + side + "][data-delta=\\\"1\\\"]";
        String result = evaluate(webView,
            "(() => { for(let i=0;i<" + count + ";i++){" +
            " const button=document.querySelector('" + selector + "'); if(!button) return false; button.click(); } return true; })()"
        );
        assertTrue("Could not score " + count + " Volleyball points for side " + side, "true".equals(result));
    }

    private void waitForScore(WebView webView, int scoreA, int scoreB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='volleyball' && s.teamA.score===" + scoreA + " && s.teamB.score===" + scoreB + "); })()",
            8000,
            "Volleyball live score " + scoreA + "-" + scoreB
        );
    }

    private void waitForSets(WebView webView, int expectedSetsA) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.teamA.sets===" + expectedSetsA + " && s.teamB.sets===0); })()",
            10000,
            "Volleyball set " + expectedSetsA + " completion"
        );
        SystemClock.sleep(100);
    }

    private void waitForMatchFinal(WebView webView, TeamFixture left, TeamFixture right) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='volleyball' && s.finished===true && s.winner==='A'" +
            " && s.teamA.name===" + q(left.name) + " && s.teamB.name===" + q(right.name) +
            " && s.teamA.sets===3 && s.teamB.sets===0" +
            " && s.volleyball?.setHistory?.length===3" +
            " && s.volleyball.setHistory[0].scoreA===25 && s.volleyball.setHistory[0].scoreB===18" +
            " && s.volleyball.setHistory[1].scoreA===25 && s.volleyball.setHistory[1].scoreB===20" +
            " && s.volleyball.setHistory[2].scoreA===25 && s.volleyball.setHistory[2].scoreB===22); })()",
            10000,
            "Volleyball final state for " + left.name + " vs " + right.name
        );
    }

    private String slug(String value) {
        return value.toLowerCase();
    }
}
