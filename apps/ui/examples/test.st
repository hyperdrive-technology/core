(*
  IEC 61131-3 Structured Text Example
  This example demonstrates various features of IEC 61131-3 ST
*)

// Single line comment example

PROGRAM TemperatureControl
  VAR_INPUT
    RoomTemperature : REAL; // Current temperature in Celsius
    SetPoint : REAL := 22.5; // Default setpoint
    ManualOverride : BOOL := FALSE;
  END_VAR

  VAR_OUTPUT
    HeatingOutput : REAL; // 0-100% heating control
    CoolingOutput : REAL; // 0-100% cooling control
    AlarmActive : BOOL := FALSE;
  END_VAR

  VAR
    TemperatureDifference : REAL;
    PreviousError : REAL := 0.0;
    IntegralTerm : REAL := 0.0;
    DerivativeTerm : REAL := 0.0;
    // PID constants
    Kp : REAL := 2.5;  // Proportional gain
    Ki : REAL := 0.5;  // Integral gain
    Kd : REAL := 0.1;  // Derivative gain
    ControlOutput : REAL;
    SampleTime : REAL := 0.1; // Sample time in seconds
    TemperatureArray : ARRAY [0..9] OF REAL; // Store last 10 temperature readings
    TemperatureIndex : INT := 0;
    TemperatureStats : STRUCT
      Min : REAL := 100.0;
      Max : REAL := -100.0;
      Average : REAL := 0.0;
    END_STRUCT;
  END_VAR

BEGIN
  // Calculate temperature difference (error)
  TemperatureDifference := SetPoint - RoomTemperature;

  // Update temperature history array
  TemperatureArray[TemperatureIndex] := RoomTemperature;
  TemperatureIndex := (TemperatureIndex + 1) MOD 10;

  // PID control algorithm
  IF NOT ManualOverride THEN
    // Proportional term
    ControlOutput := Kp * TemperatureDifference;

    // Integral term
    IntegralTerm := IntegralTerm + Ki * TemperatureDifference * SampleTime;

    // Derivative term
    DerivativeTerm := Kd * (TemperatureDifference - PreviousError) / SampleTime;

    // Calculate control output
    ControlOutput := ControlOutput + IntegralTerm + DerivativeTerm;

    // Limit control output to valid range [-100, 100]
    IF ControlOutput > 100.0 THEN
      ControlOutput := 100.0;
    ELSIF ControlOutput < -100.0 THEN
      ControlOutput := -100.0;
    END_IF;

    // Save current error for next cycle
    PreviousError := TemperatureDifference;
  END_IF;

  // Update outputs based on control signal
  IF ControlOutput > 0.0 THEN
    // Heating mode
    HeatingOutput := ControlOutput;
    CoolingOutput := 0.0;
  ELSE
    // Cooling mode
    HeatingOutput := 0.0;
    CoolingOutput := -ControlOutput;
  END_IF;

  // Calculate min, max and average temperature
  TemperatureStats.Min := 100.0;
  TemperatureStats.Max := -100.0;
  TemperatureStats.Average := 0.0;

  // FOR loop example
  FOR i := 0 TO 9 DO
    TemperatureStats.Average := TemperatureStats.Average + TemperatureArray[i];

    // Check for min/max values
    IF TemperatureArray[i] < TemperatureStats.Min THEN
      TemperatureStats.Min := TemperatureArray[i];
    END_IF;

    IF TemperatureArray[i] > TemperatureStats.Max THEN
      TemperatureStats.Max := TemperatureArray[i];
    END_IF;
  END_FOR;

  // Divide by array size to get average
  TemperatureStats.Average := TemperatureStats.Average / 10.0;

  // WHILE loop example - alarm detection
  AlarmActive := FALSE;

  WHILE NOT AlarmActive AND (TemperatureStats.Max - TemperatureStats.Min) > 10.0 DO
    // Activate alarm if temperature fluctuation is too high
    AlarmActive := TRUE;
  END_WHILE;

  // REPEAT loop example
  REPEAT
    // Simulation of a one-shot action when an alarm is raised
    IF AlarmActive AND ABS(RoomTemperature - SetPoint) > 15.0 THEN
      // Emergency override
      HeatingOutput := 0.0;
      CoolingOutput := 0.0;
    END_IF;
  UNTIL NOT AlarmActive OR ABS(RoomTemperature - SetPoint) <= 10.0
  END_REPEAT;
END
END_PROGRAM

FUNCTION CalculateHeatIndex : REAL
  VAR_INPUT
    Temperature : REAL; // Temperature in Celsius
    Humidity : REAL;    // Relative humidity in %
  END_VAR

  VAR
    TempF : REAL;      // Temperature in Fahrenheit
    HeatIndexF : REAL; // Heat index in Fahrenheit
    HeatIndexC : REAL; // Heat index in Celsius
  END_VAR

BEGIN
  // Convert Celsius to Fahrenheit
  TempF := (Temperature * 9.0 / 5.0) + 32.0;

  // Calculate heat index using the formula
  HeatIndexF := -42.379 + (2.04901523 * TempF) + (10.14333127 * Humidity);
  HeatIndexF := HeatIndexF - (0.22475541 * TempF * Humidity);
  HeatIndexF := HeatIndexF - (0.00683783 * TempF * TempF);
  HeatIndexF := HeatIndexF - (0.05481717 * Humidity * Humidity);
  HeatIndexF := HeatIndexF + (0.00122874 * TempF * TempF * Humidity);
  HeatIndexF := HeatIndexF + (0.00085282 * TempF * Humidity * Humidity);
  HeatIndexF := HeatIndexF - (0.00000199 * TempF * TempF * Humidity * Humidity);

  // Convert back to Celsius
  HeatIndexC := (HeatIndexF - 32.0) * 5.0 / 9.0;

  // Return the result
  CalculateHeatIndex := HeatIndexC;
END
END_FUNCTION

FUNCTION_BLOCK TemperatureController
  VAR_INPUT
    ActualTemperature : REAL;
    SetPoint : REAL;
    Enable : BOOL := TRUE;
  END_VAR

  VAR_OUTPUT
    HeatingOutput : REAL;
    CoolingOutput : REAL;
    Status : INT := 0; // 0: Idle, 1: Heating, 2: Cooling, 3: Error
  END_VAR

  VAR
    Error : REAL;
    Kp : REAL := 2.0;
    OutputValue : REAL;
    DeadbandLow : REAL := -0.5;
    DeadbandHigh : REAL := 0.5;
  END_VAR

BEGIN
  IF Enable THEN
    // Calculate error
    Error := SetPoint - ActualTemperature;

    // Simple P control with deadband
    IF Error > DeadbandHigh THEN
      // Need heating
      OutputValue := Kp * Error;
      HeatingOutput := OutputValue;
      CoolingOutput := 0.0;
      Status := 1; // Heating mode
    ELSIF Error < DeadbandLow THEN
      // Need cooling
      OutputValue := Kp * ABS(Error);
      HeatingOutput := 0.0;
      CoolingOutput := OutputValue;
      Status := 2; // Cooling mode
    ELSE
      // Within deadband - no action needed
      HeatingOutput := 0.0;
      CoolingOutput := 0.0;
      Status := 0; // Idle
    END_IF;
  ELSE
    // Controller disabled
    HeatingOutput := 0.0;
    CoolingOutput := 0.0;
    Status := 0;
  END_IF;
END
END_FUNCTION_BLOCK
