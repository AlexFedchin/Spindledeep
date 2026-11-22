"""Changes page: the random restart-from-the-prologue bug, and the session log (`restart/`)."""
from mkpage import page, hero

PREV = (' &middot; <a href="https://claude.ai/artifact/WGTgv9q1fD1XJBdv9Kqnc8">a darker thread</a>'
        ' &middot; <a href="https://claude.ai/artifact/RqUUscR5hSEKuRaCpLP4Rm">clean films, kept runs</a>')

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero(
    'bug fix', 'The Ghost on the Title Screen', 'Found, reproduced and fixed', 'plus a log of every session in case anything else goes wrong') + '''
  <div class="col summary">
    <p>The game wasn't crashing or reloading. It was being told to start a new game. The title screen's buttons stayed alive, invisible, while you played. If you had clicked <b>Begin</b> or <b>Begin anew</b> with the mouse, that button kept keyboard focus after the title faded out. The next press of <b>Enter</b> (the act key, used to tie and to mend the thread) or <b>Space</b> clicked it again. That replayed the prologue and started a new run over your save.</p>
    <p>It looked random because it only happened after a mouse click on the title and only on the next Enter or Space that reached the button. Pressing Enter right after a death, to mend the cut thread, is exactly the moment it fires.</p>
  </div>

  <h2>What happened</h2>
  <p class="ask">There is still some real bug with the game randomly restarting from the very beginning. Without any checkpoints, just from the opening cutscene. This time it happened right after I died one time.</p>
  <div class="col">
    <p>Reproduced in a test run with real mouse and keyboard events, in the invisible test window:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Step</th><th>Before</th><th>After the fix</th></tr></thead>
        <tbody>
          <tr><td>Click “Begin anew” with the mouse</td><td>The prologue plays; the button keeps keyboard focus</td><td>The prologue plays; nothing keeps focus</td></tr>
          <tr><td>Play to the first pole (checkpoint saved)</td><td>Saved at pole 1</td><td>Saved at pole 1</td></tr>
          <tr><td>Press Enter during play</td><td>The key lands on the invisible button: <b>“Begin anew” is clicked</b>, the save is cleared and a new run starts</td><td>No click; still at pole 1</td></tr>
          <tr><td>Esc, then Enter</td><td>Resume</td><td>Resume (menus still work from the keyboard)</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>Hidden screens are now inert.</b> When the title, pause menu or any other overlay fades out, it's also switched off completely, so nothing on it can hold focus or be clicked.</li>
      <li><b>Menu buttons never take focus,</b> even when clicked with the mouse. The menus are driven by the game's own input, as they always were from the keyboard and gamepad.</li>
      <li><b>Each menu acts only on its own screen:</b> the title menu on the title, the pause menu while paused. If something like this ever happens again, it's refused and written to the log.</li>
    </ul>
  </div>

  <h2>The session log</h2>
  <div class="col">
    <p>Every launch now writes a plain-text log. If something strange happens, send me the newest file from:</p>
    <div class="files">
      <div><b><code>%APPDATA%\\Spindledeep\\logs\\</code></b><span>One <code>session-…log</code> per launch, newest last, 10 kept. Paste that path into the Explorer address bar to open it.</span></div>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>What it records:</b> each screen (title, films, play, credits); every menu choice and whether it came from the mouse or the keys; each new run and continue; every save and the pole it was at, with a warning if writing the file failed; deaths with their cause and place; respawns; poles tied; areas entered; pause and resume.</li>
      <li><b>Problems:</b> script errors with file and line, a film that fails to play, a lost GPU device, the game process crashing or hanging, and the window closing.</li>
      <li><b>Nothing personal:</b> no keystroke log and no file paths beyond the game's own profile folder. Everything stays on your PC until you send it.</li>
    </ul>
    <div class="files" style="margin-top:16px">
      <div><b><code>app/src/main.js</code></b><span>Inert hidden screens, focus-free menu buttons, menus guarded by screen, and the log lines.</span></div>
      <div><b><code>electron/main.js</code> &middot; <code>preload.js</code></b><span>The log file, including process crashes; real mouse and key input for test runs.</span></div>
    </div>
  </div>
'''
print(page('restart', 'Spindledeep · The Ghost on the Title Screen', body, PREV))
