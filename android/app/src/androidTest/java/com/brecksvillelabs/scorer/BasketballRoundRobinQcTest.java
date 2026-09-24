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
public class BasketballRoundRobinQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "basketball";
    private static final String PERSONA = "Basketball QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie Legends", "#1d4ed8", "LEL", new String[] {
            "Ava Patel", "Maya Chen", "Sofia Ramirez", "Emma Johnson", "Priya Nair", "Layla Hassan",
            "Chloe Martin", "Isabella Garcia", "Zoe Williams", "Ananya Rao", "Mia Thompson", "Naomi Kim"
        }),
        new TeamFixture("B", "Cuyahoga Storm", "#be123c", "CS", new String[] {
            "Olivia Brown", "Aisha Khan", "Grace Lee", "Camila Rodriguez", "Nora Davis", "Isha Mehta",
            "Hannah Wilson", "Elena Petrova", "Leila Ahmed", "Ruby Anderson", "Keira Murphy", "Amara Okafor"
        }),
        new TeamFixture("C", "Brecksville Bears", "#047857", "BB", new String[] {
            "Ella Nguyen", "Saanvi Iyer", "Aria Miller", "Lucia Santos", "Sarah Cohen", "Nila Krishnan",
            "Gianna Rossi", "Fatima Ali", "Audrey Clark", "Rhea Singh", "Tessa Walker", "Daniela Lopez"
        })
    };

    private static final int[][] ROUND_ROBIN = {
        {0,1}, {1,0}, {1,2}, {2,1}, {2,0}, {0,2}
    };

    @Test
    public void basketballCreatesTeamsTracksPlayersAndCompletesRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/basketball-reference");
        resetArtifactDirectory(artifactDir);
        resetPublishedArtifactDirectory("basketball-reference");
        File reportFile = new File(artifactDir, "basketball-qc-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);

            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("type,sequence,persona,team_a,team_b,roster_a,roster_b,result,detail,screenshots,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            cleanPriorQcData(webView, SPORT, TEAMS);
            selectSport(webView, SPORT);
            createQcPersona(webView, SPORT, PERSONA);

            for (TeamFixture team : TEAMS) {
                saveTeam(webView, SPORT, team);
                report.write("team,," + csv(PERSONA) + "," + csv(team.name) + ",," +
                    team.rosterSize() + ",,," + csv("saved with basketball logo and 12-player roster") + ",,PASS\n");
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
                    captureScreenshot(new File(artifactDir, "01-basketball-team-setup.png"));
                    screenshotCount++;
                }

                startMatch(webView, SPORT, left, right);
                waitForReferenceMatchFormat(webView);
                waitForDualTeamHero(webView, left, right, 0, 0, 1, false);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "02-basketball-live-start.png"));
                    screenshotCount++;
                    runGameAndShotClockBriefly(webView);
                }

                score(webView, "A", 2, left.roster[0]);
                score(webView, "A", 3, left.roster[1]);
                score(webView, "B", 2, right.roster[0]);
                foul(webView, "B", right.roster[3]);
                timeout(webView, "B");
                waitForBasketballState(webView, 1, 5, 2, 0, 1, 5, 4);
                waitForDualTeamHero(webView, left, right, 5, 2, 1, false);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "03-basketball-q1-5-2.png"));
                    screenshotCount++;
                }

                nextQuarter(webView, 2);
                score(webView, "B", 3, right.roster[1]);
                score(webView, "A", 1, left.roster[2]);
                foul(webView, "A", left.roster[4]);
                timeout(webView, "A");
                waitForBasketballState(webView, 2, 6, 5, 1, 0, 4, 4);

                nextQuarter(webView, 3);
                score(webView, "A", 3, left.roster[3]);
                score(webView, "B", 2, right.roster[2]);
                foul(webView, "B", right.roster[5]);
                setPossession(webView, "A");
                waitForBasketballState(webView, 3, 9, 7, 0, 1, 4, 4);
                waitForDualTeamHero(webView, left, right, 9, 7, 3, false);

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "04-basketball-q3-9-7.png"));
                    screenshotCount++;
                }

                nextQuarter(webView, 4);
                score(webView, "A", 2, left.roster[4]);
                score(webView, "B", 1, right.roster[4]);
                waitForBasketballState(webView, 4, 11, 8, 0, 0, 4, 4);
                finishGame(webView);
                waitForFinal(webView, left, right);
                waitForDualTeamHero(webView, left, right, 11, 8, 4, true);

                openAndValidateFullScoreboard(webView, SPORT, left, right);
                waitForJsTrue(webView,
                    "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||'';" +
                    " return t.includes('Quarter scoring') && t.includes('Play by play')" +
                    " && t.includes('PTS') && t.includes('PF')" +
                    " && t.includes(" + q(left.roster[0]) + ")" +
                    " && t.includes(" + q(right.roster[1]) + ")" +
                    " && t.includes('Q1') && t.includes('Q4'); })()",
                    7000,
                    "Basketball full box score with named players"
                );

                if (game == 0) {
                    captureScreenshot(new File(artifactDir, "05-basketball-final-scoreboard.png"));
                    screenshotCount++;
                    screenshots = "01-basketball-team-setup.png;02-basketball-live-start.png;03-basketball-q1-5-2.png;04-basketball-q3-9-7.png;05-basketball-final-scoreboard.png";
                } else {
                    screenshots = String.format("%02d-basketball-%s-vs-%s-final.png",
                        game + 5, slug(left.label), slug(right.label));
                }

                closeFullScoreboard(webView);
                if (game > 0) {
                    captureScreenshot(new File(artifactDir, screenshots));
                    screenshotCount++;
                }

                report.write("game," + (game + 1) + "," + csv(PERSONA) + "," + csv(left.name) + "," + csv(right.name) + "," +
                    left.rosterSize() + "," + right.rosterSize() + "," + csv(left.name + " won 11-8") + "," +
                    csv("Detailed; named scoring/fouls; Q1-Q4; shot clock; fouls; timeouts; possession") + "," +
                    csv(screenshots) + ",PASS\n");
                report.flush();
            }

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').basketball?.name===" + q(PERSONA),
                5000,
                "Basketball QC persona retained"
            );

            File[] screenshots = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = screenshots == null ? 0 : screenshots.length;
            assertTrue("Expected 10 Basketball QC screenshots but found " + actualScreenshots, actualScreenshots == 10);
            assertTrue("Internal Basketball screenshot counter mismatch", screenshotCount == 10);
            report.flush();
            assertTrue("Basketball QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
            publishArtifact(reportFile, "basketball-reference");
        }
    }

    private void setReferenceMatchFormat(WebView webView) throws Exception {
        evaluate(webView,
            "document.getElementById('settingMinutes').value='10';" +
            " document.getElementById('settingTrackingMode').value='advanced';" +
            " document.getElementById('settingBasketballShotClock').value='24'; true"
        );
        waitForJsTrue(webView,
            "document.getElementById('settingMinutes').value==='10'" +
            " && document.getElementById('settingTrackingMode').value==='advanced'" +
            " && document.getElementById('settingBasketballShotClock').value==='24'",
            3000,
            "Basketball reference format in setup"
        );
    }

    private void waitForReferenceMatchFormat(WebView webView) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='basketball' && s.maxPeriods===4 && s.trackingMode==='advanced'" +
            " && s.clock?.mode==='down' && s.clock?.periodSeconds===600 && s.clock?.seconds===600" +
            " && s.basketball?.shotClockSeconds===24 && s.basketball?.shotClock===24); })()",
            7000,
            "Basketball four 10-minute quarters with 24-second shot clock"
        );
    }

    private void runGameAndShotClockBriefly(WebView webView) throws Exception {
        evaluate(webView, "document.getElementById('clockBtn').click(); 'game-clock-start'");
        evaluate(webView,
            "document.querySelector('[data-action=basketball-shot][data-value=toggle]').click(); 'shot-start'"
        );
        SystemClock.sleep(2300);
        evaluate(webView, "document.getElementById('clockBtn').click(); 'game-clock-stop'");
        evaluate(webView,
            "document.querySelector('[data-action=basketball-shot][data-value=toggle]').click(); 'shot-stop'"
        );
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.clock.running===false && s.clock.seconds<=598 && s.clock.seconds>=596" +
            " && s.basketball.shotClockRunning===false && s.basketball.shotClock<=22 && s.basketball.shotClock>=20); })()",
            6000,
            "Basketball game and shot clocks decrement together"
        );
    }

    private void selectPlayer(WebView webView, String side, String player) throws Exception {
        assertTrue("Could not select Basketball player " + player,
            "true".equals(evaluate(webView,
                "(() => { const s=document.querySelector('[data-basketball-player=" + side + "]');" +
                " if(!s)return false; s.value=" + q(player) + "; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()"
            ))
        );
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.basketball?.selectedPlayer?.[" + q(side) + "]===" + q(player) + "); })()",
            5000,
            "Basketball selected player " + player
        );
    }

    private void score(WebView webView, String side, int points, String player) throws Exception {
        selectPlayer(webView, side, player);
        assertTrue("Could not add Basketball points",
            "true".equals(evaluate(webView,
                "(() => { const b=[...document.querySelectorAll('[data-action=basketball-score][data-side=" + side + "]')]" +
                ".find(x=>Number(x.dataset.delta)===" + points + "); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void foul(WebView webView, String side, String player) throws Exception {
        selectPlayer(webView, side, player);
        assertTrue("Could not add Basketball foul",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=basketball-foul][data-side=" + side + "]');" +
                " if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void timeout(WebView webView, String side) throws Exception {
        assertTrue("Could not take Basketball timeout",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=timeout][data-side=" + side + "]');" +
                " if(!b||b.disabled)return false; b.click(); return true; })()"
            ))
        );
    }

    private void setPossession(WebView webView, String side) throws Exception {
        assertTrue("Could not set Basketball possession",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=basketball-possession][data-side=" + side + "]');" +
                " if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void nextQuarter(WebView webView, int expectedQuarter) throws Exception {
        assertTrue("Could not advance Basketball quarter",
            "true".equals(evaluate(webView,
                "(() => { const b=[...document.querySelectorAll('[data-action=period]')]" +
                ".find(x=>Number(x.dataset.delta)===1); if(!b)return false; b.click(); return true; })()"
            ))
        );
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.period===" + expectedQuarter + " && s.clock.seconds===600" +
            " && s.teamA.fouls===0 && s.teamB.fouls===0 && s.basketball.shotClock===24); })()",
            7000,
            "Basketball Q" + expectedQuarter + " reset"
        );
    }

    private void finishGame(WebView webView) throws Exception {
        assertTrue("Could not finish Basketball game",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=basketball-finish]');" +
                " if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void waitForBasketballState(WebView webView, int quarter, int scoreA, int scoreB,
                                        int foulsA, int foulsB, int timeoutsA, int timeoutsB) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='basketball' && s.period===" + quarter +
            " && s.teamA.score===" + scoreA + " && s.teamB.score===" + scoreB +
            " && s.teamA.fouls===" + foulsA + " && s.teamB.fouls===" + foulsB +
            " && s.basketball.timeouts.A===" + timeoutsA + " && s.basketball.timeouts.B===" + timeoutsB + "); })()",
            8000,
            "Basketball state Q" + quarter + " " + scoreA + "-" + scoreB
        );
    }

    private void waitForDualTeamHero(WebView webView, TeamFixture left, TeamFixture right,
                                     int scoreA, int scoreB, int quarter, boolean finished) throws Exception {
        waitForJsTrue(webView,
            "(() => {" +
            " const h=document.querySelector('.basketball-score-hero'); if(!h)return false;" +
            " const a=h.querySelector('[data-basketball-hero-team=A]');" +
            " const b=h.querySelector('[data-basketball-hero-team=B]');" +
            " const sa=h.querySelector('[data-basketball-hero-score=A]');" +
            " const sb=h.querySelector('[data-basketball-hero-score=B]');" +
            " const qtr=h.querySelector('.basketball-quarter')?.textContent||'';" +
            " const finalText=h.querySelector('.basketball-game-clock small')?.textContent||'';" +
            " const r=h.getBoundingClientRect();" +
            " return Boolean(getComputedStyle(h).display!=='none' && r.top>=0 && r.bottom<=window.innerHeight" +
            " && a?.textContent.includes(" + q(left.name) + ") && b?.textContent.includes(" + q(right.name) + ")" +
            " && sa?.textContent.trim()===" + q(String.valueOf(scoreA)) +
            " && sb?.textContent.trim()===" + q(String.valueOf(scoreB)) +
            " && qtr.includes(" + q(quarter <= 4 ? "Q" + quarter : "OT" + (quarter - 4)) + ")" +
            " && " + (finished ? "finalText.includes('Final')" : "!finalText.includes('Final')") + "); })()",
            7000,
            "Basketball dual-team hero " + left.name + " " + scoreA + "-" + scoreB + " " + right.name
        );
    }

    private void waitForFinal(WebView webView, TeamFixture left, TeamFixture right) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " const scoring=(s?.events||[]).filter(e=>e.type==='basketball.score' && e.points>0);" +
            " const fouls=(s?.events||[]).filter(e=>e.type==='basketball.foul');" +
            " const named=[...scoring,...fouls].filter(e=>Boolean(e.player)).length;" +
            " const ptsA=Object.values(s?.basketball?.playerStats?.A||{}).reduce((n,p)=>n+(p.points||0),0);" +
            " const ptsB=Object.values(s?.basketball?.playerStats?.B||{}).reduce((n,p)=>n+(p.points||0),0);" +
            " return Boolean(s && s.finished===true && s.winner==='A' && s.period===4" +
            " && s.teamA.name===" + q(left.name) + " && s.teamB.name===" + q(right.name) +
            " && s.teamA.score===11 && s.teamB.score===8 && scoring.length===9 && fouls.length===3" +
            " && named===12 && ptsA===11 && ptsB===8); })()",
            10000,
            "Basketball final named-player state"
        );
    }

    private String slug(String value) {
        return value.toLowerCase();
    }
}
