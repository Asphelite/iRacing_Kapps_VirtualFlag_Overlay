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
    $scope.flagMessage = '--'
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
    
    # Helper function to clear the display
    clearDisplay = ->
        console.log("Clearing display (calling 'off' animation)")
        $scope.currentFlag = 'off'
        $scope.flagMessage = '--'
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
    FLAG_DURATIONS =
        'checkered': 4000      # 2 frames × 500ms × 4 loops
        'disqualify': 8000     # 2 frames × 1000ms × 4 loops
        'penalty': 4000        # 2 frames × 500ms × 4 loops
        'safetycar': 11600     # (8×500 + 8×100 + 1×1000)ms × 2 loops = 5800ms per loop
        'slowdown': 2000       # 2 frames × 500ms × 2 loops
        'meatball': 4000       # 2 frames × 500ms × 4 loops
        'yellowWaving': 2000   # 2 frames × 250ms × 4 loops
        'yellow': 1500         # simpleFlagDuration (DEFAULT_FLAG_DURATION_MS = 1500)
        'debris': 3000         # 2 frames × 500ms × 3 loops (loopCount = 1500 / 500)
        'oneLapToGreen': 2400  # 4 frames × 150ms × 4 loops
        'blue': 1500           # simpleFlagDuration (DEFAULT_FLAG_DURATION_MS = 1500)
        'white': 1500          # simpleFlagDuration (DEFAULT_FLAG_DURATION_MS = 1500)
        'green': 1500          # simpleFlagDuration (DEFAULT_FLAG_DURATION_MS = 1500)
    
    # No priority system - using simple FIFO ring queue instead

    # Build active flags set from SessionFlags bitfield
    buildActiveFlagsFromBitfield = (sessionFlags) ->
        activeFlags = {}

        hasFlag = (flag) -> (sessionFlags & flag) != 0

        if hasFlag(FLAGS.CHECKERED)
            activeFlags['checkered'] = true
        if hasFlag(FLAGS.RED)
            activeFlags['disqualify'] = true
        if hasFlag(FLAGS.BLACK)
            activeFlags['penalty'] = true
        if hasFlag(FLAGS.CAUTION_WAVING)
            activeFlags['safetycar'] = true
        if hasFlag(FLAGS.FURLED)
            activeFlags['slowdown'] = true
        if hasFlag(FLAGS.REPAIR)
            activeFlags['meatball'] = true
        if hasFlag(FLAGS.YELLOW_WAVING)
            activeFlags['yellowWaving'] = true
        if hasFlag(FLAGS.YELLOW)
            activeFlags['yellow'] = true
        if hasFlag(FLAGS.DEBRIS)
            activeFlags['debris'] = true
        if hasFlag(FLAGS.BLUE)
            activeFlags['blue'] = true
        if hasFlag(FLAGS.WHITE)
            activeFlags['white'] = true
        if hasFlag(FLAGS.GREEN)
            activeFlags['green'] = true
        if hasFlag(FLAGS.ONE_LAP_TO_GREEN) and sessionType and !sessionType.includes('test') and !sessionType.includes('offline')
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
                duration = FLAG_DURATIONS[flag] or 1000
                console.log("Scheduling next callback for #{flag} in #{duration}ms")
                clearAnimationTimer = $timeout(createAnimationCallback(flag), duration)
            catch e
                console.error("Error triggering flag #{flag}:", e)
        else
            console.error("Critical: Flag #{flag} not available in overlay")

    # Watch for iRacing flag changes
    $scope.$watch 'ir.SessionFlags', (flags) ->
        console.log('Watch triggered, flags:', flags)
        if flags == undefined or flags == null
            console.log('Flags undefined or null, returning')
            return

        console.log('SessionFlags updated: 0x' + flags.toString(16))

        # Build set of currently active flags
        activeFlags = buildActiveFlagsFromBitfield(flags)
        console.log("Active flags: #{Object.keys(activeFlags).join(', ')}")

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
