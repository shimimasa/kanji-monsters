# 音と絵の見直しで追加した音

`generate-review-sounds.mjs` は外部音源を使わず、波形から効果音10個とBGM2曲の WAV を作る。ゲームには同じ名前の mp3・m4a・ogg を置く。ブラウザが再生できる形式を `AudioManager` が選ぶ。

```powershell
node scripts/audio/generate-review-sounds.mjs
$ffmpeg = 'C:\Users\socce\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe'
$names = @('se_tap','se_cancel','se_near_miss','se_capture','se_stage_clear','se_achievement','se_hint','se_evolve','se_reward','se_shield_break','bgm_minigame_hub','bgm_minigame_play')
foreach ($name in $names) {
  $base = "public/assets/audio/$name"
  & $ffmpeg -y -i "$base.wav" -codec:a libmp3lame -q:a 4 "$base.mp3"
  & $ffmpeg -y -i "$base.wav" -codec:a aac -b:a 128k "$base.m4a"
  & $ffmpeg -y -i "$base.wav" -codec:a libvorbis -q:a 4 "$base.ogg"
}
```

ffmpeg のパスはそのPCのインストール先に合わせる。変換後の WAV はゲームで使わないので、確認してから消す。
