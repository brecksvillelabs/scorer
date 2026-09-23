package com.brecksvillelabs.scorer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.os.SystemClock;
import android.webkit.WebView;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.test.platform.app.InstrumentationRegistry;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
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
        waitForJsTrue(webView,
            "(() => {" +
            " const modal=document.getElementById('setupModal');" +
            " const surface=document.getElementById('gameSurface');" +
            " const text=surface?.textContent||'';" +
            " const logos=surface?.querySelectorAll('.team-logo img').length||0;" +
            " return Boolean(modal && modal.hidden" +
            " && modal.classList.contains('hidden')" +
            " && modal.getAttribute('aria-hidden')==='true'" +
            " && getComputedStyle(modal).display==='none'" +
            " && surface && getComputedStyle(surface).display!=='none'" +
            " && text.includes(" + q(left.name) + ")" +
            " && text.includes(" + q(right.name) + ")" +
            " && logos>=2); })()",
            5000,
            sport + " setup dismissed and live scoreboard visible"
        );
        SystemClock.sleep(200);
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

    protected void resetPublishedArtifactDirectory(String subdir) {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentResolver resolver = context.getContentResolver();
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String relativePath = qcRelativePath(subdir);
        resolver.delete(
            collection,
            MediaStore.MediaColumns.RELATIVE_PATH + "=?",
            new String[] { relativePath }
        );
    }

    protected void publishArtifact(File file, String subdir) throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentResolver resolver = context.getContentResolver();
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String relativePath = qcRelativePath(subdir);

        resolver.delete(
            collection,
            MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
            new String[] { file.getName(), relativePath }
        );

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, file.getName());
        values.put(MediaStore.MediaColumns.MIME_TYPE,
            file.getName().toLowerCase().endsWith(".png") ? "image/png" : "text/csv");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(collection, values);
        assertNotNull("Could not create shared QC artifact " + file.getName(), uri);

        try (InputStream in = new FileInputStream(file);
             OutputStream out = resolver.openOutputStream(uri, "w")) {
            assertNotNull("Could not open shared QC artifact " + file.getName(), out);
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            out.flush();
        }

        ContentValues ready = new ContentValues();
        ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, ready, null, null);

        try (android.database.Cursor cursor = resolver.query(
                uri,
                new String[] { MediaStore.MediaColumns.SIZE },
                null,
                null,
                null)) {
            assertTrue("Shared QC artifact query failed " + file.getName(), cursor != null && cursor.moveToFirst());
            assertTrue("Shared QC artifact was empty " + file.getName(), cursor.getLong(0) > 0);
        }
    }

    private String qcRelativePath(String subdir) {
        return Environment.DIRECTORY_DOWNLOADS + "/scorer-qc/" + subdir + "/";
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
