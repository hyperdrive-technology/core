(*
  Water Tank Level Control System
  IEC 61131-3 Structured Text Example

  This program implements an automated water level control system
  for a multi-tank setup with overflow protection, alarms, and
  different operating modes.
*)

FUNCTION_BLOCK TankController
  VAR_INPUT
    Level : REAL; // Current water level (0-100%)
    TargetLevel : REAL := 75.0; // Target level setpoint
    FlowRate : REAL; // Incoming flow rate
    Temperature : REAL; // Water temperature
    ManualMode : BOOL := FALSE; // Manual operation mode
    ManualPumpSpeed : REAL := 0.0; // Manual pump speed (0-100%)
    EmergencyStop : BOOL := FALSE; // Emergency stop button
    ResetAlarms : BOOL := FALSE; // Alarm reset button
  END_VAR

  VAR_OUTPUT
    PumpOutput : REAL := 0.0; // Pump speed (0-100%)
    InletValve : BOOL := FALSE; // Inlet valve control
    DrainValve : BOOL := FALSE; // Drain valve control
    HighLevelAlarm : BOOL := FALSE; // High level alarm
    LowLevelAlarm : BOOL := FALSE; // Low level alarm
    OverTempAlarm : BOOL := FALSE; // Over temperature alarm
    SystemStatus : INT := 0; // System status code
    // Status codes:
    // 0: System idle
    // 1: Filling
    // 2: Draining
    // 3: Maintaining level
    // 4: Manual mode
    // 5: Emergency stop
    // 6: Alarm condition
  END_VAR

  VAR
    // Configuration parameters
    HighLevelThreshold : REAL := 90.0;
    LowLevelThreshold : REAL := 10.0;
    CriticalHighLevel : REAL := 95.0;
    CriticalLowLevel : REAL := 5.0;
    MaxTempThreshold : REAL := 60.0; // Maximum temperature in °C
    DeadbandLevel : REAL := 2.0; // Deadband for level control

    // PID control variables
    Error : REAL := 0.0;
    PrevError : REAL := 0.0;
    Integral : REAL := 0.0;
    Derivative : REAL := 0.0;
    Kp : REAL := 5.0; // Proportional gain
    Ki : REAL := 0.1; // Integral gain
    Kd : REAL := 0.5; // Derivative gain
    OutputValue : REAL := 0.0; // Controller output
    SampleTime : REAL := 0.1; // Sample time in seconds

    // Internal variables
    AlarmActive : BOOL := FALSE;
    PrevManualMode : BOOL := FALSE;
    InletDelay : TON; // Delay timer for inlet valve
    DrainDelay : TON; // Delay timer for drain valve
  END_VAR

  // Handle emergency stop
  IF EmergencyStop THEN
    PumpOutput := 0.0;
    InletValve := FALSE;
    DrainValve := FALSE;
    SystemStatus := 5; // Emergency stop
    RETURN; // Exit function block execution
  END_IF;

  // Handle alarms
  IF ResetAlarms THEN
    HighLevelAlarm := FALSE;
    LowLevelAlarm := FALSE;
    OverTempAlarm := FALSE;
    AlarmActive := FALSE;
  END_IF;

  // Check for alarm conditions
  IF Level >= CriticalHighLevel THEN
    HighLevelAlarm := TRUE;
    AlarmActive := TRUE;
  END_IF;

  IF Level <= CriticalLowLevel THEN
    LowLevelAlarm := TRUE;
    AlarmActive := TRUE;
  END_IF;

  IF Temperature >= MaxTempThreshold THEN
    OverTempAlarm := TRUE;
    AlarmActive := TRUE;
  END_IF;

  // Handle mode transitions
  IF ManualMode <> PrevManualMode THEN
    // Reset control variables on mode change
    Integral := 0.0;
    PrevManualMode := ManualMode;
  END_IF;

  // Manual mode control
  IF ManualMode THEN
    // Use manual settings
    PumpOutput := ManualPumpSpeed;

    // In manual mode, the operator controls the valves directly
    SystemStatus := 4; // Manual mode
  ELSE
    // Automatic mode control
    IF AlarmActive THEN
      // Safety actions in alarm condition
      IF HighLevelAlarm THEN
        // Open drain valve to reduce level
        DrainValve := TRUE;
        InletValve := FALSE;
        PumpOutput := 0.0;
      ELSIF LowLevelAlarm THEN
        // Open inlet valve to increase level
        DrainValve := FALSE;
        InletValve := TRUE;
        // Run pump at low speed to mix water
        PumpOutput := 10.0;
      ELSIF OverTempAlarm THEN
        // Reduce temperature by adding fresh water
        DrainValve := TRUE;
        InletValve := TRUE;
        PumpOutput := 50.0; // Circulation to mix
      END_IF;

      SystemStatus := 6; // Alarm condition
    ELSE
      // Normal operation - PID control

      // Calculate error
      Error := TargetLevel - Level;

      // Proportional term
      OutputValue := Kp * Error;

      // Integral term with anti-windup
      IF ABS(Error) < 20.0 THEN // Only integrate when error is small
        Integral := Integral + Ki * Error * SampleTime;

        // Limit integral term
        IF Integral > 50.0 THEN
          Integral := 50.0;
        ELSIF Integral < -50.0 THEN
          Integral := -50.0;
        END_IF;
      END_IF;

      // Derivative term
      Derivative := Kd * (Error - PrevError) / SampleTime;
      PrevError := Error;

      // Calculate control output
      OutputValue := OutputValue + Integral + Derivative;

      // Limit output to valid range
      IF OutputValue > 100.0 THEN
        OutputValue := 100.0;
      ELSIF OutputValue < 0.0 THEN
        OutputValue := 0.0;
      END_IF;

      // Determine operation mode based on error and thresholds
      IF ABS(Error) <= DeadbandLevel THEN
        // Within deadband - maintain level
        PumpOutput := 0.0;
        InletValve := FALSE;
        DrainValve := FALSE;
        SystemStatus := 3; // Maintaining level
      ELSIF Error > DeadbandLevel THEN
        // Level too low - fill tank
        PumpOutput := 0.0; // No pumping while filling
        InletValve := TRUE;
        DrainValve := FALSE;
        SystemStatus := 1; // Filling
      ELSIF Error < -DeadbandLevel THEN
        // Level too high - drain tank
        PumpOutput := OutputValue; // Use pump to help drain
        InletValve := FALSE;
        DrainValve := TRUE;
        SystemStatus := 2; // Draining
      END_IF;

      // Add delays for valve operations to prevent water hammer
      InletDelay(IN := InletValve, PT := T#2s);
      DrainDelay(IN := DrainValve, PT := T#1s);

      // Only actually change valve states after delays
      // But keep original logic intent in previous statements
      InletValve := InletValve AND InletDelay.Q;
      DrainValve := DrainValve AND DrainDelay.Q;
    END_IF;
  END_IF;
END_FUNCTION_BLOCK

PROGRAM WaterSystem
  VAR
    // Tank instances
    Tank1 : TankController;
    Tank2 : TankController;
    Tank3 : TankController;

    // System inputs
    MainFlowRate : REAL := 100.0; // Main inflow rate
    AmbientTemperature : REAL := 20.0; // Ambient temperature
    Tank1Level : REAL := 50.0; // Initial tank levels
    Tank2Level : REAL := 60.0;
    Tank3Level : REAL := 70.0;
    SystemEnabled : BOOL := TRUE;
    MasterEmergencyStop : BOOL := FALSE;

    // System outputs
    SystemAlarm : BOOL := FALSE;
    TotalPumpPower : REAL := 0.0;
  END_VAR

BEGIN
  // Update tank controllers
  Tank1(
    Level := Tank1Level,
    TargetLevel := 70.0,
    FlowRate := MainFlowRate,
    Temperature := AmbientTemperature + 5.0,
    ManualMode := NOT SystemEnabled,
    EmergencyStop := MasterEmergencyStop
  );

  Tank2(
    Level := Tank2Level,
    TargetLevel := 60.0,
    FlowRate := Tank1.PumpOutput * 0.8, // Flow from Tank1
    Temperature := AmbientTemperature + 3.0,
    ManualMode := NOT SystemEnabled,
    EmergencyStop := MasterEmergencyStop
  );

  Tank3(
    Level := Tank3Level,
    TargetLevel := 50.0,
    FlowRate := Tank2.PumpOutput * 0.8, // Flow from Tank2
    Temperature := AmbientTemperature + 1.0,
    ManualMode := NOT SystemEnabled,
    EmergencyStop := MasterEmergencyStop
  );

  // Calculate total system power consumption
  TotalPumpPower := Tank1.PumpOutput + Tank2.PumpOutput + Tank3.PumpOutput;

  // Set system alarm if any tank has an alarm
  SystemAlarm := Tank1.HighLevelAlarm OR Tank1.LowLevelAlarm OR Tank1.OverTempAlarm OR
                 Tank2.HighLevelAlarm OR Tank2.LowLevelAlarm OR Tank2.OverTempAlarm OR
                 Tank3.HighLevelAlarm OR Tank3.LowLevelAlarm OR Tank3.OverTempAlarm;

  // In a real system, Tank1Level, Tank2Level, Tank3Level would be updated
  // based on the controller actions and physical simulation
END
END_PROGRAM
