app = angular.module 'virtual-flag-app', []

# iRacing SDK Flag Constants (bitfield values)
FLAGS =
    CHECKERED: 0x00000001
    WHITE: 0x00000002
    GREEN: 0x00000004
    YELLOW: 0x00000008
    RED: 0x00000010
    BLUE: 0x00000020
    DEBRIS: 0x00000040
    CROSSED: 0x00000080
    YELLOW_WAVING: 0x00000100
    ONE_LAP_TO_GREEN: 0x00000200
    GREEN_HELD: 0x00000400
    TEN_TO_GO: 0x00000800
    FIVE_TO_GO: 0x00001000
    RANDOM_WAVING: 0x00002000
    CAUTION: 0x00004000
    CAUTION_WAVING: 0x00008000
    BLACK: 0x00010000
    SERVICEABLE: 0x00040000
    FURLED: 0x00080000
    REPAIR: 0x00100000
    DISQUALIFY: 0x00020000

app.service 'iRService', ($rootScope) ->
    ir = new IRacing ['SessionFlags', 'SessionInfo'], [], 100
    console.log('iRService initialized, connecting to Kapps at 127.0.0.1:8182...')

    ir.onConnect = ->
        console.log('Connected to Kapps WebSocket')
        $rootScope.$apply()

    ir.onDisconnect = ->
        console.log('iRacing disconnected')

    ir.onUpdate = (keys) ->
        if keys and keys.length > 0
            $rootScope.$apply()

    return ir

app.controller 'FlagCtrl', ($scope, iRService, $timeout) ->
    $scope.ir = ir = iRService.data
    $scope.currentFlag = 'off'
    $scope.flagMessage = 'Ready'
    clearAnimationTimer = null
    previousDisplayedFlag = null
    flagQueue = []  # Queue of flag names to display
    currentQueueIndex = 0
    sessionType = null  # Will be 'race', 'practice', 'qualify', 'test', etc.
    
    console.log('FlagCtrl initialized, ir object:', ir)
    
    # Parse SessionInfo to detect session type
    detectSessionType = (sessionInfo) ->
        if not sessionInfo
            return null
        
        try
            # SessionInfo can be an object or string, depending on Kapps version
            if typeof sessionInfo == 'object'
                # If it's an object, try to access Sessions array
                if sessionInfo.Sessions and Array.isArray(sessionInfo.Sessions) and sessionInfo.Sessions.length > 0
                    sessionType = sessionInfo.Sessions[0].SessionType
                    return sessionType.toLowerCase() if sessionType
            else if typeof sessionInfo == 'string'
                # If it's a string, parse it with regex
                typeMatch = sessionInfo.match(/Sessions:\s*-\s*SessionType:\s*(\w+)/i)
                if typeMatch and typeMatch[1]
                    return typeMatch[1].toLowerCase()
        catch e
            console.error("Error parsing SessionInfo:", e)
        
        return null
    
    # Watch for SessionInfo changes to update session type
    $scope.$watch 'ir.SessionInfo', (info) ->
        if info
            newType = detectSessionType(info)
            if newType != sessionType
                sessionType = newType
                console.log("Session type detected:", sessionType)
                
                # Re-evaluate flags when session type changes (e.g., removing oneLapToGreen)
                currentSessionFlags = ir.SessionFlags
                if currentSessionFlags
                    console.log("Session type changed, re-evaluating flags...")
                    activeFlags = buildActiveFlagsFromBitfield(currentSessionFlags)
                    
                    # Rebuild queue: keep active flags, remove inactive ones
                    newQueue = []
                    for existingFlag in flagQueue
                        if activeFlags[existingFlag]
                            newQueue.push(existingFlag)
                        else
                            console.log("Removing inactive flag after session change: #{existingFlag}")
                    
                    # Add any new active flags
                    for flagName of activeFlags
                        if flagName not in newQueue
                            console.log("Adding new flag after session change: #{flagName}")
                            newQueue.push(flagName)
                    
                    flagQueue = newQueue
                    console.log("Queue re-evaluated after session type change: #{flagQueue.join(', ')}")
                    
                    # If queue is not empty and nothing is playing, start playback
                    if previousDisplayedFlag == null and flagQueue.length > 0
                        console.log("Starting playback of queue after session change")
                        triggerFlag(flagQueue[0])
                    else if flagQueue.length == 0
                        console.log("No flags active after session change, clearing display")
                        clearDisplay()

    
    # Helper function to clear the display
    clearDisplay = ->
        console.log("Clearing display (calling 'off' animation)")
        $scope.currentFlag = 'off'
        $scope.flagMessage = 'Ready'
        previousDisplayedFlag = null
        clearAnimationTimer = null
        currentQueueIndex = 0
        
        if window.flagTest and typeof window.flagTest['off'] == 'function'
            try
                window.flagTest['off']()
                # Add follow-up clear to ensure no stuck frames
                $timeout ->
                    if window.flagTest and typeof window.flagTest['off'] == 'function'
                        window.flagTest['off']()
                    $scope.$digest()
                , 100
            catch e
                console.error("Error clearing animation:", e)
        else
            console.warn("Warning: flagTest.off() not available in window")
    
    # These are the ACTUAL animation loop durations from virtualFlagOverlay.js
    # Get Safety Car duration dynamically based on the variant used in overlay
    getSafetyCarDuration = ->
        return window.SAFETYCAR_DURATION_MS or 11600
    
    # Get flag duration from JavaScript overlay config (respects config.ini overrides)
    getFlagDuration = (flagName) ->
        return window.getFlagDuration(flagName) or 1500
    
    # Helper function to check if flag is enabled from config
    isFlagEnabled = (flagName) ->
        return window.isFlagEnabled(flagName) != false
    
    # Build active flags set from SessionFlags bitfield
    buildActiveFlagsFromBitfield = (sessionFlags) ->
        activeFlags = {}

        hasFlag = (flag) -> (sessionFlags & flag) != 0

        if hasFlag(FLAGS.CHECKERED) and isFlagEnabled('checkered')
            activeFlags['checkered'] = true
        if hasFlag(FLAGS.DISQUALIFY) and isFlagEnabled('disqualify')
            activeFlags['disqualify'] = true
        if hasFlag(FLAGS.BLACK) and isFlagEnabled('penalty')
            activeFlags['penalty'] = true
        if (hasFlag(FLAGS.CAUTION_WAVING) or hasFlag(FLAGS.CAUTION)) and isFlagEnabled('safetycar')
            activeFlags['safetycar'] = true
        if hasFlag(FLAGS.FURLED) and isFlagEnabled('slowdown')
            activeFlags['slowdown'] = true
        if hasFlag(FLAGS.REPAIR) and isFlagEnabled('meatball')
            activeFlags['meatball'] = true
        if hasFlag(FLAGS.YELLOW_WAVING) and isFlagEnabled('yellowWaving')
            activeFlags['yellowWaving'] = true
        if hasFlag(FLAGS.YELLOW) and isFlagEnabled('yellow')
            activeFlags['yellow'] = true
        if hasFlag(FLAGS.DEBRIS) and isFlagEnabled('debris')
            activeFlags['debris'] = true
        if hasFlag(FLAGS.BLUE) and isFlagEnabled('blue')
            activeFlags['blue'] = true
        if hasFlag(FLAGS.WHITE) and isFlagEnabled('white')
            activeFlags['white'] = true
        if hasFlag(FLAGS.GREEN) and isFlagEnabled('green')
            activeFlags['green'] = true
        if hasFlag(FLAGS.ONE_LAP_TO_GREEN) and sessionType and !sessionType.includes('test') and !sessionType.includes('offline') and !hasFlag(FLAGS.CHECKERED) and isFlagEnabled('oneLapToGreen')
            activeFlags['oneLapToGreen'] = true

        return activeFlags

    # Create a callback with proper variable capture
    createAnimationCallback = (flagName) ->
        ->
            console.log("Animation finished for flag: #{flagName}, checking queue...")
            currentSessionFlags = ir.SessionFlags
            console.log("Current SessionFlags: 0x#{currentSessionFlags.toString(16)}")
            activeFlags = buildActiveFlagsFromBitfield(currentSessionFlags)
            console.log("Active flags after timer: #{Object.keys(activeFlags).join(', ')}")
            
            # Update queue: keep existing flags, remove inactive ones, add new ones to the end (FIFO)
            newQueue = []
            
            # First, keep any flags that are still active (preserves FIFO order)
            for existingFlag in flagQueue
                if activeFlags[existingFlag]
                    newQueue.push(existingFlag)
                else
                    console.log("Removing inactive flag from queue: #{existingFlag}")
            
            # Then, add any new active flags that aren't in the queue yet
            for flagNameInActive of activeFlags
                if flagNameInActive not in newQueue
                    console.log("Adding new flag to end of queue: #{flagNameInActive}")
                    newQueue.push(flagNameInActive)
            
            flagQueue = newQueue
            console.log("Queue updated (FIFO): #{flagQueue.join(', ')}")
            
            if flagQueue.length == 0
                console.log("No more flags in queue, clearing display")
                clearDisplay()
            else
                # Find the current flag in the updated queue and advance to next
                currentFlagIndex = flagQueue.indexOf(flagName)
                console.log("Flag #{flagName} is at index #{currentFlagIndex} in queue (queue length: #{flagQueue.length})")
                
                if currentFlagIndex == -1
                    # Current flag was removed, start from beginning
                    console.log("Current flag was removed from queue, starting from beginning")
                    currentQueueIndex = 0
                else
                    # If only one flag in queue, don't loop it infinitely - just keep showing it
                    if flagQueue.length == 1
                        console.log("Only one flag in queue, keeping it displayed")
                        currentQueueIndex = 0
                    else
                        # Advance to next flag in queue
                        nextIndex = (currentFlagIndex + 1) % flagQueue.length
                        console.log("Advancing from index #{currentFlagIndex} to index #{nextIndex}")
                        currentQueueIndex = nextIndex
                
                nextFlag = flagQueue[currentQueueIndex]
                console.log("Triggering next flag in queue: #{nextFlag} (index #{currentQueueIndex})")
                triggerFlag(nextFlag)

    # Function to trigger flag display in JavaScript overlay
    triggerFlag = (flag) ->
        console.log("Triggering flag: #{flag}")
        
        # Cancel any pending timer
        if clearAnimationTimer
            $timeout.cancel(clearAnimationTimer)
            console.log("Cancelled pending timer")
        
        previousDisplayedFlag = flag
        $scope.currentFlag = flag
        $scope.flagMessage = flag.toUpperCase()

        # Call into the JavaScript overlay
        if window.flagTest and typeof window.flagTest[flag] == 'function'
            try
                window.flagTest[flag]()
                console.log("Flag #{flag} triggered successfully")
                
                # Set timer to show next flag in queue after animation completes
                # Call getFlagDuration() dynamically to get current config values
                duration = getFlagDuration(flag)
                console.log("Scheduling next callback for #{flag} in #{duration}ms (from current config)")
                clearAnimationTimer = $timeout(createAnimationCallback(flag), duration)
            catch e
                console.error("Error triggering flag #{flag}:", e)
        else
            console.error("Critical: Flag #{flag} not available in overlay")

    # Watch for iRacing connection status by checking if data is available
    $scope.$watch 'ir.SessionFlags', (flags) ->
        # This watcher will handle both the main flag watching AND disconnection detection
        # When iRacing disconnects, SessionFlags becomes undefined
        if flags == undefined or flags == null
            if flagQueue.length > 0
                console.log("Flags are null/undefined - iRacing likely disconnected, clearing queue")
                flagQueue = []
                clearDisplay()
            return

        console.log('SessionFlags updated: 0x' + flags.toString(16))
        console.log("Checking GREEN flag: (flags & 0x04) = " + (flags & 0x04) + " (should be non-zero if green is active)")

        # Build set of currently active flags
        activeFlags = buildActiveFlagsFromBitfield(flags)
        console.log("Active flags: #{Object.keys(activeFlags).join(', ')}")
        console.log("activeFlags['green'] = " + activeFlags['green'])

        # If green flag is active, prioritize it - clear queue and show green first
        if activeFlags['green']
            console.log("Green flag detected, prioritizing it in queue")
            flagQueue = ['green']
            console.log("Queue reset to show green flag first")
            
            # Interrupt any currently playing flag and start green immediately
            if previousDisplayedFlag != null
                console.log("Green flag interrupting currently playing flag: #{previousDisplayedFlag}")
                if clearAnimationTimer
                    $timeout.cancel(clearAnimationTimer)
                    console.log("Cancelled animation timer for: #{previousDisplayedFlag}")
            
            console.log("Starting playback with green flag (interrupting any other flag)")
            triggerFlag('green')
        else
            # Normal queue management when green is not active
            # Update the ring queue: remove inactive flags, add new ones to the end
            newQueue = []
            
            # Keep existing flags that are still active (preserves order)
            for existingFlag in flagQueue
                if activeFlags[existingFlag]
                    newQueue.push(existingFlag)
                else
                    console.log("Removing inactive flag: #{existingFlag}")
            
            # Add any new active flags to the end
            for flagName of activeFlags
                if flagName not in newQueue
                    console.log("Adding new flag to end: #{flagName}")
                    newQueue.push(flagName)
            
            flagQueue = newQueue
            console.log("Ring queue updated: #{flagQueue.join(', ')}")
            
            # If nothing is playing and we have flags, start playback
            if previousDisplayedFlag == null and flagQueue.length > 0
                console.log("Starting ring queue playback")
                currentQueueIndex = 0
                triggerFlag(flagQueue[0])
            else if flagQueue.length == 0
                console.log("No flags active, clearing display")
                clearDisplay()

    return

# Bootstrap the app
angular.bootstrap document.body, ['virtual-flag-app']
