(*
  Traffic Light Controller
  IEC 61131-3 Structured Text Example

  This program implements a traffic light controller with normal,
  night, and emergency modes.
*)

PROGRAM TrafficLightController
  VAR_INPUT
    Mode : INT := 0; // 0: Normal, 1: Night Mode, 2: Emergency
    Sensor1 : BOOL := FALSE; // Vehicle detection sensor for main road
    Sensor2 : BOOL := FALSE; // Vehicle detection sensor for side road
    EmergencyVehicle : BOOL := FALSE; // Emergency vehicle detection
    ManualOverride : BOOL := FALSE; // Manual control activation
    TimeOfDay : TIME; // Current time for scheduling
  END_VAR

  VAR_OUTPUT
    MainRoadRed : BOOL := FALSE;
    MainRoadYellow : BOOL := FALSE;
    MainRoadGreen : BOOL := FALSE;
    SideRoadRed : BOOL := FALSE;
    SideRoadYellow : BOOL := FALSE;
    SideRoadGreen : BOOL := FALSE;
    PedestrianCrossMain : BOOL := FALSE;
    PedestrianCrossSide : BOOL := FALSE;
  END_VAR

  VAR
    CurrentState : INT := 0;
    // State definitions:
    // 0: Main road green, side road red
    // 1: Main road yellow, side road red
    // 2: Main road red, side road red (transition)
    // 3: Main road red, side road green
    // 4: Main road red, side road yellow
    // 5: Emergency mode
    // 6: Night mode (flashing yellow)

    Timer : TON; // On-delay timer
    TimerPT : TIME; // Timer preset time
    PreviousMode : INT := 0; // Track mode changes
    StateChangeTime : TIME; // Time of last state change

    // Timing parameters
    MainGreenTime : TIME := T#30s;
    MainYellowTime : TIME := T#5s;
    SideGreenTime : TIME := T#20s;
    SideYellowTime : TIME := T#5s;
    TransitionTime : TIME := T#2s;

    DebounceTimer : TON; // Sensor debounce timer
    SensorActive : BOOL := FALSE; // Debounced sensor
  END_VAR

BEGIN
  // Debounce the vehicle sensors
  DebounceTimer(IN := Sensor1 OR Sensor2, PT := T#500ms);
  IF DebounceTimer.Q THEN
    SensorActive := TRUE;
  END_IF;

  // Handle mode changes
  IF Mode <> PreviousMode THEN
    CASE Mode OF
      0: // Normal mode
        CurrentState := 0;
      1: // Night mode
        CurrentState := 6;
      2: // Emergency mode
        CurrentState := 5;
    END_CASE;
    PreviousMode := Mode;
  END_IF;

  // Emergency vehicle overrides current mode
  IF EmergencyVehicle THEN
    Mode := 2;
    CurrentState := 5;
  END_IF;

  // Night mode based on time (10PM to 6AM)
  IF TimeOfDay >= T#22h0m0s OR TimeOfDay < T#6h0m0s THEN
    IF NOT ManualOverride THEN
      Mode := 1;
    END_IF;
  END_IF;

  // State machine for traffic light control
  CASE CurrentState OF
    0: // Main road green, side road red
      MainRoadRed := FALSE;
      MainRoadYellow := FALSE;
      MainRoadGreen := TRUE;
      SideRoadRed := TRUE;
      SideRoadYellow := FALSE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := TRUE;
      PedestrianCrossMain := FALSE;

      // Timer for state change
      TimerPT := MainGreenTime;
      Timer(IN := TRUE, PT := TimerPT);

      // State transition condition
      IF (Timer.Q OR (SensorActive AND Sensor2)) AND NOT EmergencyVehicle THEN
        SensorActive := FALSE;
        Timer(IN := FALSE);
        CurrentState := 1;
      END_IF;

    1: // Main road yellow, side road red
      MainRoadRed := FALSE;
      MainRoadYellow := TRUE;
      MainRoadGreen := FALSE;
      SideRoadRed := TRUE;
      SideRoadYellow := FALSE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := FALSE;

      // Timer for state change
      TimerPT := MainYellowTime;
      Timer(IN := TRUE, PT := TimerPT);

      // State transition condition
      IF Timer.Q THEN
        Timer(IN := FALSE);
        CurrentState := 2;
      END_IF;

    2: // Transition state - all red
      MainRoadRed := TRUE;
      MainRoadYellow := FALSE;
      MainRoadGreen := FALSE;
      SideRoadRed := TRUE;
      SideRoadYellow := FALSE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := FALSE;

      // Timer for state change
      TimerPT := TransitionTime;
      Timer(IN := TRUE, PT := TimerPT);

      // State transition condition
      IF Timer.Q THEN
        Timer(IN := FALSE);
        CurrentState := 3;
      END_IF;

    3: // Main road red, side road green
      MainRoadRed := TRUE;
      MainRoadYellow := FALSE;
      MainRoadGreen := FALSE;
      SideRoadRed := FALSE;
      SideRoadYellow := FALSE;
      SideRoadGreen := TRUE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := TRUE;

      // Timer for state change
      TimerPT := SideGreenTime;
      Timer(IN := TRUE, PT := TimerPT);

      // State transition condition
      IF (Timer.Q OR (SensorActive AND Sensor1)) AND NOT EmergencyVehicle THEN
        SensorActive := FALSE;
        Timer(IN := FALSE);
        CurrentState := 4;
      END_IF;

    4: // Main road red, side road yellow
      MainRoadRed := TRUE;
      MainRoadYellow := FALSE;
      MainRoadGreen := FALSE;
      SideRoadRed := FALSE;
      SideRoadYellow := TRUE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := FALSE;

      // Timer for state change
      TimerPT := SideYellowTime;
      Timer(IN := TRUE, PT := TimerPT);

      // State transition condition
      IF Timer.Q THEN
        Timer(IN := FALSE);
        CurrentState := 0;
      END_IF;

    5: // Emergency mode - main road green, side road red
      MainRoadRed := FALSE;
      MainRoadYellow := FALSE;
      MainRoadGreen := TRUE;
      SideRoadRed := TRUE;
      SideRoadYellow := FALSE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := FALSE;

      // Exit emergency mode when emergency vehicle is gone
      IF NOT EmergencyVehicle THEN
        Mode := PreviousMode;
        CurrentState := 0;
      END_IF;

    6: // Night mode - flashing yellow
      // Flashing yellow on main road, red on side road
      Timer(IN := TRUE, PT := T#1s);

      IF Timer.Q THEN
        Timer(IN := FALSE);
        MainRoadYellow := NOT MainRoadYellow;
      END_IF;

      MainRoadRed := FALSE;
      MainRoadGreen := FALSE;
      SideRoadRed := TRUE;
      SideRoadYellow := FALSE;
      SideRoadGreen := FALSE;
      PedestrianCrossSide := FALSE;
      PedestrianCrossMain := FALSE;
  END_CASE;
END
END_PROGRAM
