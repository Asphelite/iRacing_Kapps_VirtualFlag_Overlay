app = angular.module 'virtual-flag-app', []

# Get debug mode from URL
urlParams = new URLSearchParams(window.location.search)
DEBUG_MODE = urlParams.get('debug') === 'true'

# Debug logging wrapper
debugLog = (message, args...) ->
    if DEBUG_MODE
        console.log(message, args...)

# iRacing SDK Flag Constants (bitfield values)
FLAGS =
    CHECKERED: 0x00000001      # Race finished
    WHITE: 0x00000002          # 1 lap to go
    GREEN: 0x00000004          # Start/restart
    YELLOW: 0x00000008         # Local yellow
    RED: 0x00000010            # Red flag - stopped
    BLUE: 0x00000020           # Blue flag - lapping car
    DEBRIS: 0x00000040         # Debris flag
    CROSSED: 0x00000080        # Track crossed
    YELLOW_WAVING: 0x00000100  # Waving yellow (flashing)
    ONE_LAP_TO_GREEN: 0x00000200
    GREEN_HELD: 0x00000400
    TEN_TO_GO: 0x00000800
    FIVE_TO_GO: 0x00001000
    RANDOM_WAVING: 0x00002000
    CAUTION: 0x00004000        # Full course caution
    CAUTION_WAVING: 0x00008000 # Full course caution being established
    BLACK: 0x00010000          # Black flag (penalty)
    SERVICEABLE: 0x00040000
    FURLED: 0x00080000
    REPAIR: 0x00100000
    DISQUALIFY: 0x00020000     # DQ flag

# Flag categories - define which flags can coexist
FLAG_CATEGORIES =
    CRITICAL: ['checkered']                          # Highest priority, interrupts all
    SAFETY: ['red', 'safetycar']                     # Safety flags, interrupt most
    PENALTIES: ['disqualify', 'penalty', 'meatball'] # Penalties, interrupt local flags
    LOCAL_CAUTION: ['yellow', 'yellowWaving', 'debris'] # Local cautions, can coexist with lapping
    LAPPING: ['blue']                                # Lapping flags, can coexist with local cautions
    LAP_STATUS: ['white', 'oneLapToGreen']           # Lap status, doesn't interrupt much
    GREEN: ['green']                                 # Base state

# Interrupt rules: if a flag from this category is active, clear these categories
INTERRUPT_RULES =
    CRITICAL: ['SAFETY', 'PENALTIES', 'LOCAL_CAUTION', 'LAPPING', 'LAP_STATUS', 'GREEN']
    SAFETY: ['PENALTIES', 'LOCAL_CAUTION', 'LAPPING', 'LAP_STATUS', 'GREEN']
    PENALTIES: ['LOCAL_CAUTION', 'LAP_STATUS']
    LOCAL_CAUTION: ['LAP_STATUS']
    LAPPING: ['LAP_STATUS']
    GREEN: []

# Map flags to their categories
FLAG_TO_CATEGORY = {}
for category, flags of FLAG_CATEGORIES
    for flag in flags
        FLAG_TO_CATEGORY[flag] = category


app.service 'iRService', ($rootScope) ->
    ir = new IRacing ['SessionFlags', 'SessionState'], [], 100

    ir.onConnect = ->
        debugLog 'iRacing connected'
        $rootScope.$apply()

    ir.onDisconnect = ->
        debugLog 'iRacing disconnected'

    ir.onUpdate = (keys) ->
        if keys and keys.length > 0
            $rootScope.$apply()

    return ir

app.controller 'FlagCtrl', ($scope, iRService, $timeout) ->
    $scope.ir = ir = iRService.data
    $scope.currentFlag = 'off'
    $scope.flagMessage = '--'
    
    # Map flags to fallback animations for unimplemented flags
    FALLBACK_FLAGS =
        'red': 'debug'              # Unimplemented flag - show debug indicator
        'greenHeld': 'debug'
        'tenToGo': 'debug'
        'fiveToGo': 'debug'
        'randomWaving': 'debug'
        'serviceable': 'debug'
        'furled': 'debug'
        'repair': 'debug'
        'crossed': 'debug'

    # Helper: get the animation to play for a flag (with fallback)
    getFlagAnimation = (flag) ->
        # If flag exists in overlay, use it
        if window.flagTest and window.flagTest[flag]
            return flag
        
        # Show debug indicator for unimplemented flags
        console.warn "Flag '#{flag}' not implemented, showing debug indicator"
        return 'debug'


    # Helper: get category for a flag
    getCategoryForFlag = (flag) ->
        return FLAG_TO_CATEGORY[flag] or null

    # Helper: get all categories that should be cleared if this category is active
    getCategoriesInterruptedBy = (category) ->
        return INTERRUPT_RULES[category] or []

    # Build active flags set from SessionFlags bitfield
    buildActiveFlagsFromBitfield = (sessionFlags) ->
        activeFlags = {}

        hasFlag = (flag) -> (sessionFlags & flag) != 0

        if hasFlag(FLAGS.CHECKERED)
            activeFlags['checkered'] = true
        if hasFlag(FLAGS.RED)
            activeFlags['red'] = true
        if hasFlag(FLAGS.DISQUALIFY)
            activeFlags['disqualify'] = true
        if hasFlag(FLAGS.BLACK)
            activeFlags['penalty'] = true
        if hasFlag(FLAGS.CAUTION_WAVING)
            activeFlags['safetycar'] = true
        if hasFlag(FLAGS.CAUTION)
            activeFlags['slowdown'] = true
        if hasFlag(FLAGS.YELLOW_WAVING)
            activeFlags['yellowWaving'] = true
        if hasFlag(FLAGS.YELLOW)
            activeFlags['yellow'] = true
        if hasFlag(FLAGS.DEBRIS)
            activeFlags['debris'] = true
        if hasFlag(FLAGS.ONE_LAP_TO_GREEN)
            activeFlags['oneLapToGreen'] = true
        if hasFlag(FLAGS.BLUE)
            activeFlags['blue'] = true
        if hasFlag(FLAGS.WHITE)
            activeFlags['white'] = true
        if hasFlag(FLAGS.GREEN)
            activeFlags['green'] = true

        return activeFlags

    # Build queue based on active flags and interrupt rules
    buildQueueFromActiveFlags = (activeFlags) ->
        queue = []
        interruptedCategories = {}

        # First pass: identify which categories are interrupting
        for flag of activeFlags
            category = getCategoryForFlag(flag)
            if category
                interrupted = getCategoriesInterruptedBy(category)
                for int_cat in interrupted
                    interruptedCategories[int_cat] = true

        # Second pass: add flags to queue if their category isn't interrupted
        for flag of activeFlags
            category = getCategoryForFlag(flag)
            if category and not interruptedCategories[category]
                queue.push(flag)
            else if not category
                queue.push(flag)

        debugLog "Built queue from active flags: #{queue.join(', ')}"
        return queue

    # Update the queue based on current active flags
    updateQueue = (activeFlags) ->
        newQueue = buildQueueFromActiveFlags(activeFlags)

        # Remove flags from queue that are no longer active
        $scope.flagQueue = newQueue.filter((flag) -> activeFlags[flag])

        # If queue changed and we're not animating, start playing
        if $scope.flagQueue.length > 0 and not $scope.isAnimating
            playNextFlagInQueue()

    # Play the next flag in queue
    playNextFlagInQueue = () ->
        if $scope.flagQueue.length == 0
            $scope.currentlyPlaying = null
            $scope.currentFlag = 'off'
            return

        # Get next flag
        nextFlag = $scope.flagQueue.shift()
        debugLog "Playing flag from queue: #{nextFlag}, remaining: #{$scope.flagQueue.length}"
        
        $scope.currentlyPlaying = nextFlag
        $scope.isAnimating = true
        
        triggerFlag(nextFlag)

    # Callback that JavaScript calls when animation is done
    window.onFlagAnimationComplete = () ->
        debugLog 'Flag animation completed, playing next in queue'
        $scope.$apply(() ->
            $scope.isAnimating = false
            playNextFlagInQueue()
        )

    # Watch for iRacing flag changes
    $scope.$watch 'ir.SessionFlags', onSessionFlagsChange = (flags) ->
        if flags == undefined or flags == null
            return

        # Only process if flags have changed
        if flags == $scope.lastFlagValue
            return

        $scope.lastFlagValue = flags

        debugLog 'SessionFlags updated: 0x' + flags.toString(16)

        # Build set of currently active flags
        $scope.activeFlags = buildActiveFlagsFromBitfield(flags)
        debugLog "Active flags: #{Object.keys($scope.activeFlags).join(', ')}"

        # Update queue based on new active flags
        updateQueue($scope.activeFlags)

    # Watch for session state changes
    $scope.$watch 'ir.SessionState', onSessionStateChange = (state) ->
        if state == undefined or state == null
            return
        
        debugLog 'SessionState:', state
        # 0 = Off, 1 = Warmup, 2 = ParadeLaps, 3 = Racing, etc.
        if state == 0
            $scope.activeFlags = {}
            $scope.flagQueue = []
            triggerFlag('off')

    # Function to trigger flag display in JavaScript overlay
    triggerFlag = (flag) ->
        debugLog "Triggering flag: #{flag}"
        
        # Get the actual animation to play (with fallback)
        animationFlag = getFlagAnimation(flag)
        
        $scope.currentFlag = animationFlag
        $scope.flagMessage = flag.toUpperCase()

        # Call into the JavaScript overlay
        if window.flagTest and window.flagTest[animationFlag]
            try
                window.flagTest[animationFlag]()
                if animationFlag != flag
                    debugLog "Flag #{flag} played as #{animationFlag} (fallback)"
                else
                    debugLog "Flag #{flag} triggered successfully"
            catch e
                console.error "Error triggering flag #{animationFlag}:", e
        else
            console.error "Critical: Flag #{animationFlag} not available in overlay"

    # Expose for manual testing if needed
    $scope.triggerFlag = triggerFlag



    return

# Bootstrap the app
angular.bootstrap document, [app.name]
