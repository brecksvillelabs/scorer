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
public class SoccerRoundRobinQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "soccer";
    private static final String PERSONA = "Soccer QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie FC", "#1d4ed8", "LEF", new String[] {
            "Ava Patel", "Maya Chen", "Sofia Ramirez", "Emma Johnson", "Priya Nair", "Layla Hassan",
            "Chloe Martin", "Isabella Garcia", "Zoe Williams", "Ananya Rao", "Mia Thompson", "Naomi Kim",
            "Ella Nguyen", "Rhea Singh", "Lucia Santos", "Sarah Cohen", "Gianna Rossi", "Fatima Ali"
        }),
        new TeamFixture("B", "Cleveland City SC", "#be123c", "CCS", new String[] {
            "Olivia Brown", "Aisha Khan", "Grace Lee", "Camila Rodriguez", "Nora Davis", "Isha Mehta",
            "Hannah Wilson", "Elena Petrova", "Leila Ahmed", "Ruby Anderson", "Keira Murphy", "Amara Okafor",
            "Audrey Clark", "Nila Krishnan", "Tessa Walker", "Daniela Lopez", "Saanvi Iyer", "Aria Miller"
        }),
        new TeamFixture("C", "Brecksville United", "#047857", "BU", new String[] {
            "Mila Shah", "Nadia Rahman", "Sophie Turner", "Meera Joshi", "Lina Park", "Gabriela Silva",
            "Noor Ibrahim", "Avery Brooks", "Ivy Chen", "Zara Malik", "Maya Thomas", "Elise Martin",
            "Priyanka Das", "Hana Suzuki", "Clara Rossi", "Sofia Mendes", "Amelia Wilson", "Rina Kapoor"
        })
    };

    private static final int[][] ROUND_ROBIN = {
        {0,1}, {1,0}, {1,2}, {2,1}, {2,0}, {0,2}
    };

    @Test
    public void soccerCreatesTeamsTracksMatchEventsAndCompletesRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/soccer-reference");
        resetArtifactDirectory(artifactDir);
        resetPublishedArtifactDirectory("soccer-reference");
        File reportFile = new File(artifactDir, "soccer-qc-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("type,sequence,persona,team_a,team_b,roster_a,roster_b,result,cards,screenshots,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            cleanPriorQcData(webView, SPORT, TEAMS);
            selectSport(webView, SPORT);
            createQcPersona(webView, SPORT, PERSONA);

            for (TeamFixture team : TEAMS) {
                saveTeam(webView, SPORT, team);
                report.write("team,," + csv(PERSONA) + "," + csv(team.name) + ",," +
                    team.rosterSize() + ",,," + csv("saved with soccer logo") + ",,PASS\n");
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
                    captureScreenshot(new File(artifactDir, "01-soccer-team-setup.png"));
                    screenshotCount++;
                }

                startMatch(webView, SPORT, left, right);
                waitForReferenceMatchFormat(webView);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "02-soccer-live-start.png"));
                    screenshotCount++;
                    runClockBriefly(webView);
                }

                goal(webView, "A", left.roster[0]);
                card(webView, "B", "yellow", right.roster[3]);
                if (game == 0) {
                    waitForScoreAndCards(webView, 1, 0, 0, 0, 1, 0);
                    captureScreenshot(new File(artifactDir, "03-soccer-first-half-1-0-yellow.png"));
                    screenshotCount++;
                }

                nextHalf(webView);
                waitForSecondHalf(webView);

                if (game == 0) runClockBriefly(webView);

                goal(webView, "B", right.roster[1]);
                card(webView, "A", "yellow", left.roster[4]);
                goal(webView, "A", left.roster[2]);
                card(webView, "B", "red", right.roster[5]);

                waitForScoreAndCards(webView, 2, 1, 1, 0, 1, 1);

                if (game == 0) {
                    waitForJsTrue(webView,
                        "Boolean(document.querySelector('.soccer-match-clock b')?.textContent.startsWith('45:') || " +
                        "document.querySelector('.soccer-match-clock b')?.textContent.startsWith('46:'))",
                        5000,
                        "Soccer cumulative second-half clock"
                    );
                    captureScreenshot(new File(artifactDir, "04-soccer-second-half-2-1-cards.png"));
                    screenshotCount++;
                }

                finishMatch(webView);
                waitForMatchFinal(webView, left, right);
                openAndValidateFullScoreboard(webView, SPORT, left, right);

                waitForJsTrue(webView,
                    "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||'';" +
                    " return t.includes('Match events') && t.includes('Yellow card') && t.includes('Red card')" +
                    " && t.includes('Half-by-half') && t.includes(" + q(left.roster[0]) + ")" +
                    " && t.includes(" + q(right.roster[1]) + "); })()",
                    5000,
                    "Soccer full match-center timeline"
                );

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "05-soccer-final-scoreboard.png"));
                    screenshotCount++;
                    screenshots = "01-soccer-team-setup.png;02-soccer-live-start.png;03-soccer-first-half-1-0-yellow.png;04-soccer-second-half-2-1-cards.png;05-soccer-final-scoreboard.png";
                } else {
                    screenshots = String.format("%02d-soccer-%s-vs-%s-final.png",
                        game + 5, slug(left.label), slug(right.label));
                }

                closeFullScoreboard(webView);

                if (game > 0) {
                    captureScreenshot(new File(artifactDir, screenshots));
                    screenshotCount++;
                }

                report.write("game," + (game + 1) + "," + csv(PERSONA) + "," + csv(left.name) + "," + csv(right.name) + "," +
                    left.rosterSize() + "," + right.rosterSize() + "," + csv(left.name + " won 2-1") + "," +
                    csv("A 1Y/0R; B 1Y/1R") + "," + csv(screenshots) + ",PASS\n");
                report.flush();
            }

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').soccer?.name===" + q(PERSONA),
                5000,
                "Soccer QC persona retained"
            );

            File[] screenshots = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = screenshots == null ? 0 : screenshots.length;
            assertTrue("Expected 10 Soccer QC screenshots but found " + actualScreenshots, actualScreenshots == 10);
            assertTrue("Internal Soccer screenshot counter mismatch", screenshotCount == 10);
            report.flush();
            assertTrue("Soccer QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
            publishArtifact(reportFile, "soccer-reference");
        }
    }

    private void setReferenceMatchFormat(WebView webView) throws Exception {
        evaluate(webView,
            "document.getElementById('settingMinutes').value='45';" +
            " document.getElementById('settingTrackingMode').value='advanced'; true"
        );
        waitForJsTrue(webView,
            "document.getElementById('settingMinutes').value==='45'" +
            " && document.getElementById('settingTrackingMode').value==='advanced'",
            3000,
            "Soccer 45-minute half format in setup"
        );
    }

    private void waitForReferenceMatchFormat(WebView webView) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='soccer' && s.maxPeriods===2 && s.trackingMode==='advanced'" +
            " && s.clock?.mode==='up' && s.clock?.periodSeconds===2700 && s.clock?.targetSeconds===2700); })()",
            5000,
            "Soccer two 45-minute halves"
        );
    }

    private void runClockBriefly(WebView webView) throws Exception {
        evaluate(webView, "document.getElementById('clockBtn').click(); 'clock-start'");
        SystemClock.sleep(1300);
        evaluate(webView, "document.getElementById('clockBtn').click(); 'clock-stop'");
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && s.clock.running===false && s.clock.seconds>=1); })()",
            5000,
            "Soccer brief clock run"
        );
    }

    private void selectPlayer(WebView webView, String side, String player) throws Exception {
        String result = evaluate(webView,
            "(() => { const s=document.querySelector('[data-soccer-player=" + side + "]');" +
            " if(!s)return false; s.value=" + q(player) + "; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()"
        );
        assertTrue("Could not select Soccer player " + player + " for side " + side, "true".equals(result));
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.soccer?.selectedPlayer?.[" + q(side) + "]===" + q(player) + "); })()",
            5000,
            "Soccer selected player " + player
        );
    }

    private void goal(WebView webView, String side, String player) throws Exception {
        selectPlayer(webView, side, player);
        String selector = "[data-action=soccer-goal][data-side=" + side + "][data-delta=\"1\"]";
        assertTrue("Could not score Soccer goal for side " + side,
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('" + selector + "'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void card(WebView webView, String side, String color, String player) throws Exception {
        selectPlayer(webView, side, player);
        String selector = "[data-action=soccer-card][data-side=" + side + "][data-value=" + color + "]";
        assertTrue("Could not add Soccer " + color + " card for side " + side,
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('" + selector + "'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void nextHalf(WebView webView) throws Exception {
        assertTrue("Could not advance Soccer to second half",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=period][data-delta=\"1\"]'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void waitForSecondHalf(WebView webView) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " const clock=document.querySelector('.soccer-match-clock b')?.textContent||'';" +
            " return Boolean(s && s.period===2 && s.clock.seconds===0 && clock==='45:00'); })()",
            7000,
            "Soccer second half at cumulative 45:00"
        );
    }

    private void finishMatch(WebView webView) throws Exception {
        assertTrue("Could not finish Soccer match",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=soccer-finish]'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void waitForScoreAndCards(WebView webView, int scoreA, int scoreB,
                                      int yellowsA, int redsA, int yellowsB, int redsB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='soccer' && s.teamA.score===" + scoreA +
            " && s.teamB.score===" + scoreB +
            " && s.teamA.yellows===" + yellowsA + " && s.teamA.reds===" + redsA +
            " && s.teamB.yellows===" + yellowsB + " && s.teamB.reds===" + redsB + "); })()",
            8000,
            "Soccer score/cards state"
        );
    }

    private void waitForMatchFinal(WebView webView, TeamFixture left, TeamFixture right) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " const goals=(s?.events||[]).filter(e=>e.type==='soccer.goal' && e.delta>0).length;" +
            " const yellows=(s?.events||[]).filter(e=>e.type==='soccer.yellow' && e.delta>0).length;" +
            " const reds=(s?.events||[]).filter(e=>e.type==='soccer.red' && e.delta>0).length;" +
            " const named=(s?.events||[]).filter(e=>['soccer.goal','soccer.yellow','soccer.red'].includes(e.type) && e.delta>0 && Boolean(e.player)).length;" +
            " return Boolean(s && s.sport==='soccer' && s.finished===true && s.winner==='A'" +
            " && s.teamA.name===" + q(left.name) + " && s.teamB.name===" + q(right.name) +
            " && s.teamA.score===2 && s.teamB.score===1" +
            " && s.teamA.yellows===1 && s.teamA.reds===0" +
            " && s.teamB.yellows===1 && s.teamB.reds===1" +
            " && goals===3 && yellows===2 && reds===1 && named===6); })()",
            10000,
            "Soccer final state for " + left.name + " vs " + right.name
        );
    }

    private String slug(String value) {
        return value.toLowerCase();
    }
}
