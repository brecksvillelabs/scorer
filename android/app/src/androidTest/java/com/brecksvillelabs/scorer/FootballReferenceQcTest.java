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
public class FootballReferenceQcTest extends RoundRobinQcSupport {

    private static final String SPORT = "football";
    private static final String PERSONA = "Football QC Operator";

    private static final TeamFixture[] TEAMS = {
        new TeamFixture("A", "Lake Erie Thunder", "#1d4ed8", "LET", new String[] {
            "Aiden Carter","Noah Patel","Liam Brooks","Ethan Williams","Mason Clark","Lucas Reed",
            "Caleb Johnson","Jayden Hill","Owen Martin","Elijah Brown","Henry Davis","Leo Garcia",
            "Jack Wilson","Wyatt Moore","Grayson Lee","Isaac Thompson","Julian Harris","Cameron Allen",
            "Dylan Young","Nathan King","Miles Scott","Adrian Baker","Aaron Green","Connor Wright"
        }),
        new TeamFixture("B", "Cuyahoga Wolves", "#be123c", "CW", new String[] {
            "Marcus Evans","Jordan Collins","Tyler Mitchell","Brandon Lewis","Xavier Walker","Eli Hall",
            "Logan Turner","Christian Adams","Ryan Campbell","Jace Parker","Nolan Edwards","Cole Morris",
            "Austin Rivera","Hunter Cook","Carson Morgan","Dominic Bell","Cooper Murphy","Blake Bailey",
            "Ian Cooper","Asher Richardson","Easton Cox","Micah Howard","Roman Ward","Gavin Torres"
        }),
        new TeamFixture("C", "Brecksville Mustangs", "#047857", "BM", new String[] {
            "Arjun Shah","Rohan Mehta","Dev Patel","Samir Nair","Aarav Iyer","Neil Rao",
            "Kiran Singh","Vikram Kumar","Aman Verma","Rishi Gupta","Kabir Malhotra","Dhruv Joshi",
            "Nikhil Desai","Rahul Menon","Sanjay Khanna","Vivek Anand","Akhil Kapoor","Tarun Bose",
            "Arnav Sethi","Milan Roy","Kunal Chopra","Yash Bhat","Ishan Jain","Ravi Prasad"
        })
    };

    private static final int[][] ROUND_ROBIN = {
        {0,1}, {1,0}, {1,2}, {2,1}, {2,0}, {0,2}
    };

    @Test
    public void footballExercisesBasicDetailedFieldAndRoundRobin() throws Exception {
        File external = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        assertNotNull(external);
        File artifactDir = new File(external, "scorer-qc/football-reference");
        resetArtifactDirectory(artifactDir);
        resetPublishedArtifactDirectory("football-reference");
        File reportFile = new File(artifactDir, "football-qc-report.csv");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
             BufferedWriter report = new BufferedWriter(new FileWriter(reportFile, false))) {

            AtomicReference<MainActivity> activityRef = new AtomicReference<>();
            scenario.onActivity(activityRef::set);
            MainActivity activity = activityRef.get();
            assertNotNull(activity);
            WebView webView = activity.getBridge().getWebView();
            assertNotNull(webView);

            report.write("type,sequence,persona,mode,team_a,team_b,roster_a,roster_b,result,detail,screenshots,status\n");
            report.flush();

            waitForJsTrue(webView, "Boolean(document.getElementById('startGameBtn'))", 20000, "Scorer setup controls");
            cleanPriorQcData(webView, SPORT, TEAMS);
            selectSport(webView, SPORT);
            createQcPersona(webView, SPORT, PERSONA);

            for (TeamFixture team : TEAMS) {
                saveTeam(webView, SPORT, team);
                report.write("team,," + csv(PERSONA) + ",," + csv(team.name) + ",," +
                    team.rosterSize() + ",,," + csv("saved with football logo and 24-player imported roster") + ",,PASS\n");
                report.flush();
            }
            assertSavedTeams(webView, SPORT, TEAMS);

            int screenshots = 0;

            // 1) Detailed reference game: yardage, player attribution, red zone, halftime reset and scorecard.
            TeamFixture left = TEAMS[0], right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, true);
            captureScreenshot(new File(artifactDir, "01-football-detailed-setup.png")); screenshots++;
            startMatch(webView, SPORT, left, right);
            waitForFormat(webView, true);
            waitForHero(webView, left, right, 0, 0, 1, false);
            waitForField(webView, left.name + " 25", "1st & 10", 25, "A");
            captureScreenshot(new File(artifactDir, "02-football-live-start-field.png")); screenshots++;

            selectPlayer(webView, "A", left.roster[0]);
            logPlay(webView, 4, "run");
            selectPlayer(webView, "A", left.roster[1]);
            logPlay(webView, 7, "pass");
            waitForField(webView, left.name + " 36", "1st & 10", 36, "A");
            captureScreenshot(new File(artifactDir, "03-football-drive-yardage.png")); screenshots++;

            setSpot(webView, 92);
            setSituation(webView, 3, 8);
            waitForField(webView, right.name + " 8", "3rd & Goal", 92, "A");
            captureScreenshot(new File(artifactDir, "04-football-red-zone-goal.png")); screenshots++;

            score(webView, "A", "touchdown", left.roster[1]);
            score(webView, "A", "pat", left.roster[2]);
            setPossession(webView, "B");
            setSpot(webView, 75);
            score(webView, "B", "field-goal", right.roster[0]);
            waitForHero(webView, left, right, 7, 3, 1, false);

            nextQuarter(webView, 2);
            timeout(webView, "A");
            timeout(webView, "A");
            waitForTimeouts(webView, 1, 3);
            nextQuarter(webView, 3);
            waitForTimeouts(webView, 3, 3);

            score(webView, "A", "touchdown", left.roster[3]);
            score(webView, "A", "pat", left.roster[4]);
            score(webView, "B", "touchdown", right.roster[2]);
            score(webView, "B", "pat", right.roster[3]);
            nextQuarter(webView, 4);
            finish(webView);
            waitForFinal(webView, left, right, 14, 10, 4);
            openAndValidateFullScoreboard(webView, SPORT, left, right);
            waitForJsTrue(webView,
                "(() => { const t=document.getElementById('fullScoreboardContent')?.textContent||'';" +
                " return t.includes('Quarter-by-quarter') && t.includes('Field position')" +
                " && t.includes('Drive events') && t.includes(" + q(left.roster[1]) + ")" +
                " && t.includes('14') && t.includes('10'); })()",
                7000,
                "Football detailed full scorecard with field and named drive event"
            );
            captureScreenshot(new File(artifactDir, "05-football-final-scoreboard.png")); screenshots++;
            closeFullScoreboard(webView);
            reportGame(report, 1, "Detailed", left, right, "14-10",
                "yardage + field spot + 3rd & Goal + named scoring + halftime timeout reset",
                "01-football-detailed-setup.png;02-football-live-start-field.png;03-football-drive-yardage.png;04-football-red-zone-goal.png;05-football-final-scoreboard.png");

            // 2) Basic scorer must stay clean: no field/roster controls.
            left = TEAMS[1]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, false);
            startMatch(webView, SPORT, left, right);
            waitForFormat(webView, false);
            waitForBasicMode(webView);
            score(webView, "A", "touchdown", null);
            score(webView, "A", "pat", null);
            score(webView, "A", "field-goal", null);
            score(webView, "B", "touchdown", null);
            score(webView, "B", "pat", null);
            advanceToQuarter(webView, 4);
            finish(webView);
            waitForFinal(webView, left, right, 10, 7, 4);
            captureScreenshot(new File(artifactDir, "06-football-basic-final.png")); screenshots++;
            reportGame(report, 2, "Basic", left, right, "10-7",
                "basic score/quarter/clock only; no field or player attribution controls",
                "06-football-basic-final.png");

            // 3) Detailed fourth-down failure should turn the ball over at the same spot.
            left = TEAMS[1]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, true);
            startMatch(webView, SPORT, left, right);
            setSpot(webView, 40);
            setSituation(webView, 4, 5);
            selectPlayer(webView, "A", left.roster[5]);
            logPlay(webView, 2, "run");
            waitForField(webView, left.name + " 42", "1st & 10", 42, "B");
            captureScreenshot(new File(artifactDir, "07-football-turnover-on-downs.png")); screenshots++;
            score(webView, "B", "field-goal", right.roster[0]);
            advanceToQuarter(webView, 4);
            finish(webView);
            waitForFinal(webView, left, right, 0, 3, 4);
            reportGame(report, 3, "Detailed", left, right, "0-3",
                "4th-and-5 +2 yd turnover on downs; same ball spot; possession/direction flip",
                "07-football-turnover-on-downs.png");

            // 4) Detailed opposite-direction field state and safety scoring.
            left = TEAMS[2]; right = TEAMS[1];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, true);
            startMatch(webView, SPORT, left, right);
            setPossession(webView, "B");
            setSpot(webView, 98);
            setSituation(webView, 2, 7);
            score(webView, "A", "safety", left.roster[7]);
            waitForField(webView, right.name + " 2", "2nd & 7", 98, "B");
            waitForHero(webView, left, right, 2, 0, 1, false);
            captureScreenshot(new File(artifactDir, "08-football-opposite-direction-safety.png")); screenshots++;
            advanceToQuarter(webView, 4);
            finish(webView);
            waitForFinal(webView, left, right, 2, 0, 4);
            reportGame(report, 4, "Detailed", left, right, "2-0",
                "opposite attack direction + editable B 2-yard field position + safety",
                "08-football-opposite-direction-safety.png");

            // 5) Basic regulation tie proceeds to overtime.
            left = TEAMS[2]; right = TEAMS[0];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, false);
            startMatch(webView, SPORT, left, right);
            score(webView, "A", "touchdown", null);
            score(webView, "A", "pat", null);
            score(webView, "B", "touchdown", null);
            score(webView, "B", "pat", null);
            advanceToQuarter(webView, 4);
            nextQuarter(webView, 5);
            waitForHero(webView, left, right, 7, 7, 5, false);
            score(webView, "A", "field-goal", null);
            finish(webView);
            waitForFinal(webView, left, right, 10, 7, 5);
            captureScreenshot(new File(artifactDir, "09-football-overtime-final.png")); screenshots++;
            reportGame(report, 5, "Basic", left, right, "10-7 OT",
                "regulation tie → OT1 → field goal → final",
                "09-football-overtime-final.png");

            // 6) Detailed midfield web snapshot and named play.
            left = TEAMS[0]; right = TEAMS[2];
            loadSavedTeamsIntoSetup(webView, SPORT, left, right);
            setFormat(webView, true);
            startMatch(webView, SPORT, left, right);
            setSpot(webView, 50);
            setSituation(webView, 2, 6);
            selectPlayer(webView, "A", left.roster[8]);
            logPlay(webView, 15, "pass");
            waitForField(webView, right.name + " 35", "1st & 10", 65, "A");
            score(webView, "A", "field-goal", left.roster[9]);
            advanceToQuarter(webView, 4);
            finish(webView);
            waitForFinal(webView, left, right, 3, 0, 4);
            captureScreenshot(new File(artifactDir, "10-football-midfield-named-final.png")); screenshots++;
            reportGame(report, 6, "Detailed", left, right, "3-0",
                "midfield placement + named 15-yard pass + webpage-ready field state",
                "10-football-midfield-named-final.png");

            assertSavedTeams(webView, SPORT, TEAMS);
            waitForJsTrue(webView,
                "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}').football?.name===" + q(PERSONA),
                5000,
                "Football QC persona retained"
            );

            File[] pngs = artifactDir.listFiles((dir, name) -> name.endsWith(".png"));
            int actualScreenshots = pngs == null ? 0 : pngs.length;
            assertTrue("Expected 10 Football QC screenshots but found " + actualScreenshots, actualScreenshots == 10);
            assertTrue("Internal Football screenshot counter mismatch", screenshots == 10);
            report.flush();
            assertTrue("Football QC CSV report was not written", reportFile.isFile() && reportFile.length() > 0);
            publishArtifact(reportFile, "football-reference");
        }
    }

    private void setFormat(WebView webView, boolean detailed) throws Exception {
        evaluate(webView,
            "document.getElementById('settingMinutes').value='12';" +
            " document.getElementById('settingTrackingMode').value=" + q(detailed ? "advanced" : "simple") + "; true"
        );
    }

    private void waitForFormat(WebView webView, boolean detailed) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport==='football' && s.maxPeriods===4" +
            " && s.clock?.periodSeconds===720 && s.clock?.seconds===720" +
            " && s.trackingMode===" + q(detailed ? "advanced" : "simple") +
            " && s.football?.ballSpot===25 && s.football?.down===1 && s.football?.distance===10); })()",
            7000,
            "Football " + (detailed ? "detailed" : "basic") + " 12-minute format"
        );
    }

    private void waitForBasicMode(WebView webView) throws Exception {
        waitForJsTrue(webView,
            "(() => { const g=document.getElementById('gameSurface'); return Boolean(g" +
            " && g.querySelector('.football-score-hero')" +
            " && !g.querySelector('.football-drive-panel')" +
            " && !g.querySelector('[data-football-player]')); })()",
            5000,
            "Football basic scorer has no detailed field/player controls"
        );
    }

    private void selectPlayer(WebView webView, String side, String player) throws Exception {
        if (player == null) return;
        assertTrue("Could not select Football player " + player,
            "true".equals(evaluate(webView,
                "(() => { const s=document.querySelector('[data-football-player=" + side + "]');" +
                " if(!s)return false; s.value=" + q(player) + "; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()"
            ))
        );
    }

    private void score(WebView webView, String side, String type, String player) throws Exception {
        selectPlayer(webView, side, player);
        assertTrue("Could not score Football " + type + " for side " + side,
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=football-score][data-side=" + side + "][data-score-type=" + type + "]');" +
                " if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void setSpot(WebView webView, int spot) throws Exception {
        assertTrue("Could not set Football spot " + spot,
            "true".equals(evaluate(webView,
                "(() => { const i=document.getElementById('footballSpotInput'); const b=document.querySelector('[data-action=football-set-spot]');" +
                " if(!i||!b)return false; i.value=" + q(String.valueOf(spot)) + "; b.click(); return true; })()"
            ))
        );
    }

    private void setSituation(WebView webView, int down, int distance) throws Exception {
        assertTrue("Could not set Football down/distance",
            "true".equals(evaluate(webView,
                "(() => { const d=document.getElementById('footballDownInput'); const y=document.getElementById('footballDistanceInput'); const b=document.querySelector('[data-action=football-set-situation]');" +
                " if(!d||!y||!b)return false; d.value=" + q(String.valueOf(down)) + "; y.value=" + q(String.valueOf(distance)) + "; b.click(); return true; })()"
            ))
        );
    }

    private void logPlay(WebView webView, int yards, String type) throws Exception {
        assertTrue("Could not log Football play",
            "true".equals(evaluate(webView,
                "(() => { const y=document.getElementById('footballYardsInput'); const t=document.getElementById('footballPlayType'); const b=document.querySelector('[data-action=football-play]');" +
                " if(!y||!t||!b)return false; y.value=" + q(String.valueOf(yards)) + "; t.value=" + q(type) + "; b.click(); return true; })()"
            ))
        );
    }

    private void setPossession(WebView webView, String side) throws Exception {
        assertTrue("Could not set Football possession " + side,
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=football-possession][data-side=" + side + "]'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void timeout(WebView webView, String side) throws Exception {
        assertTrue("Could not take Football timeout " + side,
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=timeout][data-side=" + side + "]'); if(!b||b.disabled)return false; b.click(); return true; })()"
            ))
        );
    }

    private void waitForTimeouts(WebView webView, int a, int b) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s?.football?.timeouts?.A===" + a + " && s?.football?.timeouts?.B===" + b + "); })()",
            5000,
            "Football timeouts " + a + "-" + b
        );
    }

    private void nextQuarter(WebView webView, int expected) throws Exception {
        assertTrue("Could not advance Football period",
            "true".equals(evaluate(webView,
                "(() => { const b=[...document.querySelectorAll('[data-action=period]')].find(x=>Number(x.dataset.delta)===1); if(!b)return false; b.click(); return true; })()"
            ))
        );
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && s.period===" + expected + " && s.clock.running===false && s.clock.seconds===720); })()",
            7000,
            "Football period " + expected
        );
    }

    private void advanceToQuarter(WebView webView, int target) throws Exception {
        while (true) {
            String current = evaluate(webView,
                "(() => JSON.parse(localStorage.getItem('scorer-state-v2')||'null')?.period || 0)()"
            );
            int value = Integer.parseInt(current.replace("\"", "").trim());
            if (value >= target) return;
            nextQuarter(webView, value + 1);
        }
    }

    private void finish(WebView webView) throws Exception {
        assertTrue("Could not finish Football game",
            "true".equals(evaluate(webView,
                "(() => { const b=document.querySelector('[data-action=football-finish]'); if(!b)return false; b.click(); return true; })()"
            ))
        );
    }

    private void waitForHero(WebView webView, TeamFixture left, TeamFixture right,
                             int scoreA, int scoreB, int period, boolean finished) throws Exception {
        String label = period <= 4 ? "Q" + period : "OT" + (period - 4);
        waitForJsTrue(webView,
            "(() => { const h=document.querySelector('.football-score-hero'); if(!h)return false;" +
            " const a=h.querySelector('[data-football-hero-team=A]'); const b=h.querySelector('[data-football-hero-team=B]');" +
            " const sa=h.querySelector('[data-football-hero-score=A]'); const sb=h.querySelector('[data-football-hero-score=B]');" +
            " const p=h.querySelector('.football-period')?.textContent||''; const r=h.getBoundingClientRect();" +
            " return Boolean(r.top>=0 && r.bottom<=window.innerHeight" +
            " && a?.textContent.includes(" + q(left.name) + ") && b?.textContent.includes(" + q(right.name) + ")" +
            " && sa?.textContent.trim()===" + q(String.valueOf(scoreA)) + " && sb?.textContent.trim()===" + q(String.valueOf(scoreB)) +
            " && " + (finished ? "p.includes('FINAL')" : "p.includes(" + q(label) + ")") + "); })()",
            7000,
            "Football dual-team hero " + scoreA + "-" + scoreB + " " + label
        );
        assertNoBlockingNavigation(webView, "Football hero");
    }

    private void waitForField(WebView webView, String spotLabel, String situation, int spot, String possession) throws Exception {
        waitForJsTrue(webView,
            "(() => { const g=document.getElementById('gameSurface'); const f=g?.querySelector('.football-field'); const m=g?.querySelector('.football-ball-marker');" +
            " const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); const text=g?.textContent||'';" +
            " return Boolean(f && m && text.includes(" + q(spotLabel) + ") && text.includes(" + q(situation) + ")" +
            " && s?.football?.ballSpot===" + spot + " && s?.football?.possession===" + q(possession) + "); })()",
            7000,
            "Football field " + spotLabel + " " + situation
        );
    }

    private void waitForFinal(WebView webView, TeamFixture left, TeamFixture right,
                              int scoreA, int scoreB, int period) throws Exception {
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null'); return Boolean(s && s.finished===true" +
            " && s.teamA.score===" + scoreA + " && s.teamB.score===" + scoreB + " && s.period===" + period +
            " && !document.querySelector('[data-action=football-score]')" +
            " && !document.querySelector('[data-action=football-play]')); })()",
            8000,
            "Football final state"
        );
        waitForHero(webView, left, right, scoreA, scoreB, period, true);
    }

    private void reportGame(BufferedWriter report, int sequence, String mode,
                            TeamFixture left, TeamFixture right, String result,
                            String detail, String screenshots) throws Exception {
        report.write("game," + sequence + "," + csv(PERSONA) + "," + csv(mode) + "," +
            csv(left.name) + "," + csv(right.name) + "," + left.rosterSize() + "," + right.rosterSize() + "," +
            csv(result) + "," + csv(detail) + "," + csv(screenshots) + ",PASS\n");
        report.flush();
    }
}
