package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.test.platform.app.InstrumentationRegistry;

import java.io.File;
import java.io.FileOutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

abstract class RoundRobinQcSupport {

    protected static final class TeamFixture {
        final String label;
        final String name;
        final String color;
        final String initials;
        final String[] roster;

        TeamFixture(String label, String name, String color, String initials, String[] roster) {
            this.label = label;
            this.name = name;
            this.color = color;
            this.initials = initials;
            this.roster = roster;
        }

        int rosterSize() {
            return roster.length;
        }

        String rosterText() {
            return String.join("\n", roster);
        }
    }

    protected void resetArtifactDirectory(File directory) {
        deleteRecursively(directory);
        assertTrue("Could not create QC artifact directory " + directory, directory.mkdirs() || directory.isDirectory());
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        assertTrue("Could not delete stale QC artifact " + file, file.delete());
    }

    protected void cleanPriorQcData(WebView webView, String sport, TeamFixture[] teams) throws Exception {
        StringBuilder names = new StringBuilder("[");
        for (int i = 0; i < teams.length; i++) {
            if (i > 0) names.append(",");
            names.append(q(teams[i].name));
        }
        names.append("]");

        evaluate(webView,
            "(() => {" +
            " const names=" + names + ";" +
            " const favoriteKey='scorer-favorite-teams-v1';" +
            " const favorites=JSON.parse(localStorage.getItem(favoriteKey)||'[]')" +
            ".filter(x=>!(x.sport===" + q(sport) + " && names.includes(x.name)));" +
            " localStorage.setItem(favoriteKey,JSON.stringify(favorites));" +
            " const personaKey='scorer-qc-personas-v1';" +
            " const personas=JSON.parse(localStorage.getItem(personaKey)||'{}');" +
            " delete personas[" + q(sport) + "];" +
            " localStorage.setItem(personaKey,JSON.stringify(personas));" +
            " localStorage.removeItem('scorer-state-v2');" +
            " location.reload(); return true;" +
            " })()"
        );

        waitForJsTrue(webView,
            "Boolean(document.getElementById('startGameBtn') && document.querySelector('.sport-choice[data-sport=" + sport + "]'))",
            20000,
            sport + " shell reload after QC cleanup"
        );
    }

    protected void selectSport(WebView webView, String sport) throws Exception {
        evaluate(webView,
            "document.querySelector('.sport-choice[data-sport=" + sport + "]').click(); 'selected'"
        );
        waitForJsTrue(webView,
            "document.querySelector('.sport-choice.active')?.dataset.sport===" + q(sport),
            8000,
            sport + " selection"
        );
        SystemClock.sleep(150);
    }

    protected void createQcPersona(WebView webView, String sport, String persona) throws Exception {
        evaluate(webView,
            "(() => { const key='scorer-qc-personas-v1'; const p=JSON.parse(localStorage.getItem(key)||'{}');" +
            " p[" + q(sport) + "]={id:" + q("qc-" + sport) + ",name:" + q(persona) + ",sport:" + q(sport) + "};" +
            " localStorage.setItem(key,JSON.stringify(p)); return true; })()"
        );
        waitForJsTrue(webView,
            "JSON.parse(localStorage.getItem('scorer-qc-personas-v1')||'{}')[" + q(sport) + "]?.name===" + q(persona),
            5000,
            sport + " QC persona"
        );
    }

    protected void saveTeam(WebView webView, String sport, TeamFixture team) throws Exception {
        String svg = logoSvg(team);
        evaluate(webView,
            "(() => {" +
            " document.getElementById('favoriteSelectA').value='';" +
            " document.getElementById('inputNameA').value=" + q(team.name) + ";" +
            " document.getElementById('inputColorA').value=" + q(team.color) + ";" +
            " document.getElementById('inputRosterA').value=" + q(team.rosterText()) + ";" +
            " const file=new File([" + q(svg) + "]," + q("qc-" + sport + "-" + team.label + ".svg") + ",{type:'image/svg+xml'});" +
            " const dt=new DataTransfer(); dt.items.add(file);" +
            " const input=document.getElementById('inputLogoA'); input.files=dt.files;" +
            " input.dispatchEvent(new Event('change',{bubbles:true})); return true;" +
            " })()"
        );

        waitForJsTrue(webView,
            "Boolean(document.querySelector('#logoPreviewA img')?.src.startsWith('data:image/svg+xml'))",
            8000,
            team.name + " logo preview"
        );

        evaluate(webView, "document.getElementById('saveFavoriteA').click(); 'saved'");
        waitForJsTrue(webView,
            "(() => { const f=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]');" +
            " const p=f.find(x=>x.sport===" + q(sport) + " && x.name===" + q(team.name) + ");" +
            " return Boolean(p && p.logo && p.roster.length===" + team.rosterSize() + "); })()",
            8000,
            team.name + " saved team with logo and roster"
        );
    }

    protected void assertSavedTeams(WebView webView, String sport, TeamFixture[] teams) throws Exception {
        StringBuilder checks = new StringBuilder();
        for (int i = 0; i < teams.length; i++) {
            TeamFixture team = teams[i];
            if (i > 0) checks.append(" && ");
            checks.append("f.some(x=>x.name===")
                .append(q(team.name))
                .append(" && Boolean(x.logo) && x.roster.length===")
                .append(team.rosterSize())
                .append(")");
        }
        waitForJsTrue(webView,
            "(() => { const f=JSON.parse(localStorage.getItem('scorer-favorite-teams-v1')||'[]').filter(x=>x.sport===" + q(sport) + ");" +
            " return " + checks + "; })()",
            10000,
            sport + " saved team fixtures"
        );
    }

    protected void loadSavedTeamsIntoSetup(WebView webView, String sport, TeamFixture left, TeamFixture right) throws Exception {
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
            " return load('A'," + q(left.name) + ") && load('B'," + q(right.name) + ");" +
            " })()"
        );

        waitForJsTrue(webView,
            "(() => {" +
            " const a=document.getElementById('inputRosterA').value.split(/\\n/).filter(Boolean).length;" +
            " const b=document.getElementById('inputRosterB').value.split(/\\n/).filter(Boolean).length;" +
            " return document.getElementById('inputNameA').value===" + q(left.name) +
            " && document.getElementById('inputNameB').value===" + q(right.name) +
            " && a===" + left.rosterSize() + " && b===" + right.rosterSize() +
            " && document.getElementById('inputLogoA').files.length===1" +
            " && document.getElementById('inputLogoB').files.length===1" +
            " && Boolean(document.querySelector('#logoPreviewA img') && document.querySelector('#logoPreviewB img'));" +
            " })()",
            12000,
            sport + " saved teams reloaded into setup"
        );
        SystemClock.sleep(400);
    }

    protected void startMatch(WebView webView, String sport, TeamFixture left, TeamFixture right) throws Exception {
        evaluate(webView, "document.getElementById('startGameBtn').click(); 'started'");
        waitForJsTrue(webView,
            "(() => { const s=JSON.parse(localStorage.getItem('scorer-state-v2')||'null');" +
            " return Boolean(s && s.sport===" + q(sport) +
            " && s.teamA.name===" + q(left.name) +
            " && s.teamB.name===" + q(right.name) +
            " && s.teamA.logo && s.teamB.logo" +
            " && s.teamA.roster.length===" + left.rosterSize() +
            " && s.teamB.roster.length===" + right.rosterSize() + "); })()",
            10000,
            sport + " persisted game start"
        );
    }

    protected void openAndValidateFullScoreboard(WebView webView, String sport, TeamFixture left, TeamFixture right) throws Exception {
        evaluate(webView, "document.getElementById('fullScoreboardBtn').click(); 'scorecard-open'");
        waitForJsTrue(webView,
            "(() => { const host=document.getElementById('fullScoreboardContent'); const text=host?.textContent||'';" +
            " return Boolean(host && !document.getElementById('fullScoreboardModal').classList.contains('hidden')" +
            " && text.includes(" + q(left.name) + ") && text.includes(" + q(right.name) + ")); })()",
            10000,
            sport + " full scoreboard"
        );
        assertTrue("Share Score must be enabled for " + sport,
            "true".equals(evaluate(webView,
                "Boolean(document.getElementById('shareScoreBtn') && !document.getElementById('shareScoreBtn').disabled)"
            ))
        );
    }

    protected void closeFullScoreboard(WebView webView) throws Exception {
        evaluate(webView, "document.getElementById('closeFullScoreboardBtn').click(); 'scorecard-closed'");
        waitForJsTrue(webView,
            "document.getElementById('fullScoreboardModal').classList.contains('hidden')",
            5000,
            "full scoreboard close"
        );
        SystemClock.sleep(150);
    }

    protected void captureScreenshot(File file) throws Exception {
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
        publishArtifact(file, file.getParentFile().getName());
    }

    protected void resetPublishedArtifactDirectory(String subdir) throws Exception {
        String durableDir = "/sdcard/Download/scorer-qc/" + subdir;
        runShell("rm -rf " + durableDir + " && mkdir -p " + durableDir);
        assertTrue("Could not create durable QC artifact directory " + durableDir,
            "true".equals(runShell("if [ -d " + durableDir + " ]; then echo true; else echo false; fi").trim()));
    }

    protected void publishArtifact(File file, String subdir) throws Exception {
        String durableDir = "/sdcard/Download/scorer-qc/" + subdir;
        String durablePath = durableDir + "/" + file.getName();
        runShell("mkdir -p " + durableDir + " && cp " + shellQuote(file.getAbsolutePath()) + " " + shellQuote(durablePath));
        assertTrue("Durable QC artifact was not published " + file.getName(),
            "true".equals(runShell("if [ -s " + shellQuote(durablePath) + " ]; then echo true; else echo false; fi").trim()));
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private String runShell(String command) throws Exception {
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new ParcelFileDescriptor.AutoCloseInputStream(descriptor)))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (output.length() > 0) output.append('\n');
                output.append(line);
            }
        }
        return output.toString();
    }

    protected String logoSvg(TeamFixture team) {
        return "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>" +
            "<rect x='6' y='6' width='148' height='148' rx='34' fill='" + team.color + "' stroke='white' stroke-width='8'/>" +
            "<circle cx='80' cy='62' r='35' fill='rgba(255,255,255,0.16)'/>" +
            "<path d='M28 116 L80 90 L132 116 L80 142 Z' fill='rgba(255,255,255,0.18)'/>" +
            "<text x='80' y='73' text-anchor='middle' font-family='sans-serif' font-weight='700' font-size='28' fill='white'>" +
            team.initials + "</text>" +
            "<text x='80' y='126' text-anchor='middle' font-family='sans-serif' font-weight='700' font-size='14' fill='white'>VOLLEYBALL</text>" +
            "</svg>";
    }

    protected String csv(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    protected String q(String value) {
        return "'" + value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\r", "\\r")
            .replace("\n", "\\n") + "'";
    }

    protected void waitForJsTrue(WebView webView, String script, long timeoutMs, String description) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        do {
            if ("true".equals(evaluate(webView, script))) return;
            SystemClock.sleep(150);
        } while (SystemClock.elapsedRealtime() < deadline);
        throw new AssertionError("Timed out waiting for packaged Scorer " + description);
    }

    protected String evaluate(WebView webView, String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        webView.post(() -> webView.evaluateJavascript(script, value -> {
            result.set(value);
            latch.countDown();
        }));
        assertTrue("Timed out evaluating QC JavaScript", latch.await(20, TimeUnit.SECONDS));
        return result.get();
    }
}
