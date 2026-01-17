# Virtual Flag Overlay for Kapps (iRacing)

A custom LED matrix flag overlay for the Kapps iRacing overlay tool that displays race flags from your iRacing session. 
Features 14+ flag animations with intelligent queuing and split/compact display modes.

## Demo

[Watch the demo on YouTube](https://youtu.be/-9FrQy7Lx7M)

## Discord

I made a Discord Server specifically for all my mods so I can provide support and post updates freely.

[Asphelite's Modding Discord Invite Link](https://discord.gg/rfqx7Wx7MB)

<!-- ## Quick Start -->

## Installation

Important: If you're already using apps/widgets like the [Weather App](https://github.com/Rovlgut/ir_WeatherApp) you might already have the necessary things set up. The `apps` directory
linked in the installation guide is necessary for my overlay to work - whether you have it installed in `%appdata%` or in your Documents does not matter. Its just important that iRacing "somehow" has access to it. This should make it clear to you that, if this is your first additional overlay, you need to follow the steps below. Else, simply get [the latest release](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay/releases/latest) and drop it into your custom overlays directory that you've already been using.

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

### Safety Car Animation Variant

**`?SCvariant=simple1|simple2|complex`**
- Choose the Safety Car flag animation style
- `?SCvariant=simple1` - Animated rotating yellow border with SC letters
- `?SCvariant=simple2` - Solid yellow border with flashing SC letters
- `?SCvariant=complex` - Complex animation pattern (default)
- Default: `complex`
- Example: `?SCvariant=simple1` for a "less obnoxious" animation

### Combined Examples

You can combine multiple parameters:

```
?mode=split&opacity=0.8&idleFade=20&SCvariant=simple1
?mode=compact&text=false&opacity=0.4&idleFade=0
?mode=split&opacity=0.6&idleFade=30&SCvariant=complex
```

## Expanded Customizability using the Configuration File (config.ini)

You can customize individual flag behavior by editing the `config.ini` file in the VirtualFlag directory.

### Enable/Disable Specific Flags

In the `[flags_enabled]` section, set a flag to `false` to disable it:

```ini
[flags_enabled]
green=true
yellow=true
blue=false        # Disable blue flag
safetycar=true
```

Disabled flags will not display even if iRacing sends them.

### Custom Animation Loop Counts

In the `[loop_counts]` section, modify the loop count for any flag to control how long it displays:

```ini
[loop_counts]
green=2            # Play green flag animation 2 times instead of 1
blue=6             # Play blue flag animation 6 times instead of 4
penalty=2          # Shorten penalty animation to 2 loops instead of 4
```

All flags show their default loop count values that you can freely modify. The system automatically calculates the total display duration based on the loop count and frame durations. Higher loop count = longer animation display time.
The loop count comes into effect when theres multiple flags in effect.

### Simple Flags Flash Speed Control

In the `[simple_flags]` section, you can control the flash speed of simple flags.
Flags affected by this setting are: Green, Yellow, White, and the Debris:

```ini
[simple_flags]
frame_ms=500       # Default: 500ms per flash state
```

The `frame_ms` value controls how long each flash state (on or off) lasts in milliseconds:
- **Slower flash** (less annoying): `frame_ms=1000` - One full on/off cycle takes 2 seconds per loop
- **Default** (balanced): `frame_ms=500` - One full on/off cycle takes 1 second per loop  
- **Faster flash** (more attention-grabbing): `frame_ms=250` - One full on/off cycle takes 0.5 seconds per loop

**Example:** With `frame_ms=500` and `green=4`:
- Each on/off cycle takes 1 second
- Green flag plays 4 loops = 4 seconds total display time

### Animation Frame Duration Control for other Flags

In the `[frame_durations]` section, you can customize the animation speed for all multi-frame flags:

```ini
[frame_durations]
yellowWaving_ms     = 250   # Double yellow animation speed
blue_ms             = 500   # Blue flag animation speed
penalty_ms          = 500   # Penalty flag animation speed
meatball_ms         = 500   # Meatball flag animation speed
slowdown_ms         = 500   # Slowdown flag animation speed
debris_ms           = 500   # Debris flag animation speed
disqualify_ms       = 1000  # Disqualify flag animation speed
checkered_ms        = 500   # Checkered flag animation speed
oneLapToGreen_ms    = 150   # One-lap-to-green animation speed
safetycar_simple1_ms = 150  # Safety Car simple1 variant animation speed
safetycar_simple2_ms = 1000 # Safety Car simple2 variant animation speed
```

Each value controls the duration of individual animation frames in milliseconds. Higher values make animations slower and more visible, lower values make them faster.
- **Slower** (more visible): Higher values like 1000-2000ms
- **Default** (balanced): 150-500ms depending on the flag
- **Faster** (grabs attention): Lower values like 50-150ms

**Note:** The Safety Car complex animation is not adjustable - only the simple1 and simple2 variants use `safetycar_simple_ms`.

This setting is independent from the loop count - you can:
- Change the flash speed globally without affecting how many times each flag loops
- Adjust loop counts per-flag without affecting the flash speed


### Config.ini Example

```ini
[flags_enabled]
green=true
yellow=true
yellowWaving=false     # Disable double yellow
blue=true
white=true
penalty=true
disqualify=true
meatball=true
slowdown=true
checkered=true
safetycar=true
debris=true
oneLapToGreen=true

[loop_counts]
green=4
yellow=4
yellowWaving=4
blue=4                 # You can customize any flag - higher value = longer animation
white=4
penalty=4
disqualify=4
meatball=4
slowdown=2
checkered=4
safetycar=1            # Safety car loop count (depends on SCvariant - complex, simple1, simple2)
debris=4
oneLapToGreen=2

[frame_durations]
yellowWaving_ms     = 250   # Custom duration per frame for double yellow animation
blue_ms             = 500   # Custom duration per frame for blue flag
penalty_ms          = 500   # Custom duration per frame for penalty flag
meatball_ms         = 500   # Custom duration per frame for meatball flag
slowdown_ms         = 500   # Custom duration per frame for slowdown flag
debris_ms           = 500   # Custom duration per frame for debris flag
disqualify_ms       = 1000  # Custom duration per frame for disqualify flag
checkered_ms        = 500   # Custom duration per frame for checkered flag
oneLapToGreen_ms    = 150   # Custom duration per frame for one-lap-to-green animation
safetycar_simple_ms = 150   # Custom duration per frame for safety car simple variants (simple1, simple2) - The complex variant has hardcoded durations

[simple_flags]
frame_ms = 500  # Flash speed for green, yellow, white, and debris flags (milliseconds per state)
```

### Test Mode

Add **`?test=true`** to the overlay URL to cycle through all flag animations in order:
- Each flag displays for a few seconds using its configured loop count
- Test mode now respects your config.ini settings automatically
- Perfect for verifying the size of the LED matrixes on your screen
- Check the browser console (press **F12**) to see detailed logs of what's loading and which flags are enabled/disabled

**To test config changes live:**
1. Edit `config.ini` and save
2. Reload the page in your browser (press **F5**)
3. When in Debug Mode: Open the browser console (**F12**) to see what config values were loaded
4. Test mode will use your new settings immediately

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
- Text Asphelite on [Asphelite's Modding Discord](https://discord.gg/rfqx7Wx7MB)
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
- Animations queue automatically without overlapping
- The green flag is the only flag that can overwrite other flags and their animations when it gets added to the queue. This is so that the green flag roughly starts playing when iRacing drops it too

### Issues and / or Limitations
- The app might not properly recognize that iRacing has closed, so if you dont hide the widget in the replay or when you're not in iRacing you might still see the last flag that was playing on constant loop. You can clear it by re-opening the overlay.

## Credits

Created for iRacing Kapps overlay framework. <br>
All credit for the Kapps Overlay app go to [kutu](https://github.com/kutu). <br>
[iRSDK Documentation](https://sajax.github.io/irsdkdocs/telemetry/sessionflags.html#sessionflags) <br>

Overlay created by [Asphelite](https://github.com/Asphelite) ; &copy; 2026-01 <br>

For issues or feature requests, contact [Asphelite](https://github.com/Asphelite) on [Asphelite's Modding Discord](https://discord.gg/rfqx7Wx7MB), [Kapps Discord](https://kapps.kutu.ru/discord/) or visit the [repository](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay) and [create an issue](https://github.com/Asphelite/iRacing_Kapps_VirtualFlag_Overlay/issues).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
