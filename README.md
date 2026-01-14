# Virtual Flag Overlay for Kapps (iRacing)

A custom LED matrix flag overlay for the Kapps iRacing overlay tool that displays race flags from your iRacing session. 
Features 14+ flag animations with intelligent queuing and split/compact display modes.

## Demo

[Watch the demo on YouTube](https://youtu.be/-9FrQy7Lx7M)

<!-- ## Quick Start -->

## Installation

### Preparing Kapps

The Kapps apps folder is located at:
```
C:\Users\[YourUsername]\AppData\Roaming\Kapps\
```

**"How do I get there?":**
1. Press `Win + R` to open the `Run Console`
2. Type: `%appdata%`
3. Press Enter
4. Navigate to the `Kapps\iRacingBrowserApps\` directory.

Paste the `apps` directory you downloaded [from here](https://ir-apps.kutu.ru/#!/) into the 
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Kapps\iRacingBrowserApps\
   ```
directory.

![You can get the apps here:](images/Kapps_DownloadApps_Directory.png)

5. **Download the VirtualFlag Widget** [The latest release](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay/releases/latest)
6. **Copy the VirtualFlag directory** to your Kapps apps directory:
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Kapps\iRacingBrowserApps\apps\
   ```

### Adding the Widget to Kapps

1. Open Kapps, then head to `Settings`.
2. In the `Settings` tab, the `Apps Folder` should now have this link pasted in (and clicking on the arrow should get you to the directory as well)

![This is how it needs to look once we added the `apps` directory to Kapps' `iRacingBrowserApps`](images/KappsSettings.png)

3. If thats all set, press `Save` and we can head to the next steps.

Next we add the widget to your overlay.

4. **Open Kapps** and go to the **Racing Overlay** tab
5. Click the `Add Custom Overlay` button to add a new overlay
6. Now we populate the fields:   -
   - Name: You can add a name of your choice.
   - URL: `http://127.0.0.1:8182/VirtualFlag/` - This has to be this link.

![Yours could look like this too...](images/Kapps_AddCustomOverlay.png)

## Display Options (URL Parameters)

You can customize the overlay's widget background appearance using URL parameters as explained below.

### Display Mode

**`?mode=split`**
- Split screen with **two 8x16 LED matrices** side-by-side (resize your widget to make proper use of this)
- Each matrix has its own background opacity
- Better for placing the matrices at opposite ends of your virtual mirror for example
- *Default: Compact mode*

**`?mode=compact`**
- Single **16x16 LED matrix** (default)
- More compact, better for smaller screens
- Text message displayed below matrix

### Background Opacity

**`?opacity=0.0` to `?opacity=1.0`**
- Controls the background opacity (0 = transparent, 1 = fully opaque [not recommended])
- Default: `0.35` (slight transparency)
- Example: `?opacity=0.5` for 50% opacity

### Message Text

**`?text=false`**
- Hides the text message below the flag in compact mode
- Default: Text is shown
- Example: `?text=false&mode=compact`

### Widget Idle Fade

**`?idleFade=SECONDS`**
- Controls when the overlay fades after inactivity
- Value is in **seconds**
- `?idleFade=0` - Disable idle fade (no fading)
- `?idleFade=15` - Fade after 15 seconds (default)
- `?idleFade=30` - Fade after 30 seconds
- When faded, the overlay returns to full brightness when the next flag appears
- Example: `?idleFade=20` for 20-second timeout
- Default: 15 seconds

### Combined Examples

You can combine multiple parameters:

```
?mode=split&opacity=0.8&idleFade=20
?mode=compact&text=false&opacity=0.4&idleFade=0
?mode=split&opacity=0.6&idleFade=30
```

### Test Mode

Add **`?test=true`** to the overlay URL to cycle through all flag animations:
- Each flag displays for a few seconds
- Perfect for verifying the size of the LED matrixes on your screen.

To test a specific flag, add:
- `?test=true&flag=flagname`
  - Examples: `flag=yellow`, `flag=checkered`, `flag=safetycar`

### Available Test Flags

green, yellow, yellowWaving, blue, white, penalty, disqualify, meatball, slowdown, checkered, safetycar, debris, oneLapToGreen

## Troubleshooting

### Want to see detailed debug information?
- Add `?debug=true` to the overlay URL for console logging
- Default: Only shows startup message

### For anything more complex
- Text Asphelite on [Kapps Discord](https://kapps.kutu.ru/discord/)
- This is guide pretty self explanatory but I'll try my best to help you.


## How It Works

### iRacing SessionFlags

The app monitors real-time `SessionFlags` from iRacing and displays the current flag. It intelligently queues multiple simultaneous flags based on racing priority.

**Supported Flags:**
- **Green**          - Session Green (Simple Green)
- **Yellow**         - General caution (Simple Yellow)
- **Yellow Waving**  - A "Double Yellow" animation
- **Blue**           - Faster traffic/lapping
- **White**          - Final lap
- **Penalty**        - Penalty/violation (naughty naughty)
- **Disqualify**     - Disqualified
- **Meatball**       - Your car is toast!
- **Slow Down**      - Slow Down penalty when cutting the track
- **One Lap To Go**  - Final lap of race (animated)
- **Checkered**      - Race over.
- **Safety Car**     - Safety car deployed
- **Debris**         - Debris on track
- **Red**            - Session stopped (Not implemented as theres no 'Red Flag' in iRacing)

### Flag Queueing

Flags use a simple **ring queue**:
- When multiple flags are active simultaneously, they're added to a queue in the order detected
- Each flag plays its animation, then the queue moves to the next flag
- As flags become inactive in iRacing, they're automatically removed from the queue
- New active flags are appended to the end of the queue, maintaining playback order

### Animation Sequences

Each flag has its own unique animation:
- **Simple flags** (Green, Yellow, White) - Flashing
- **Complex animations** (OneLapToGo, Disqualify, Blue Flag, etc.) - LED patterns
- **Caution flags** ((Double)Yellow, Debris, Safety Car) - Directional animations
- Animations queue automatically without overlapping

## Credits

Created for iRacing Kapps overlay framework.
All credit for the Kapps Overlay app go to [kutu](https://github.com/kutu).
[iRSDK Documentation](https://sajax.github.io/irsdkdocs/telemetry/sessionflags.html#sessionflags)

Overlay created by [Asphelite](https://github.com/Asphelite) ; &copy; 2026-01 <br>
Credit where credit is due. If you use my work in any form I would greatly appreciate credit and/or mentions in accordance with common knowledge and attached licenses - Thanks!
If it crashes your sim or your Kapps, thats bad. But I dont want to be held accountable so like always with mods etc.: Use at your own discretion!

For issues or feature requests, contact [Asphelite](https://github.com/Asphelite) on the [Kapps Discord](https://kapps.kutu.ru/discord/) or visit the [repository](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay) and [create an issue](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay/issues).
