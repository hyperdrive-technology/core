(*
  Manufacturing Production Line Control
  IEC 61131-3 Structured Text Example

  This program implements a production line controller for a
  packaging system with multiple stations, conveyors, and quality control.
*)

TYPE ProductType : (
  Unknown,
  TypeA,  (* Small package *)
  TypeB,  (* Medium package *)
  TypeC   (* Large package *)
);
END_TYPE

TYPE ProductionStats : STRUCT
  TotalProduced : DINT := 0;
  TypeACount : DINT := 0;
  TypeBCount : DINT := 0;
  TypeCCount : DINT := 0;
  RejectedCount : DINT := 0;
  LineEfficiency : REAL := 0.0; (* Percentage *)
  CurrentRate : REAL := 0.0;    (* Units per minute *)
END_STRUCT;
END_TYPE

FUNCTION_BLOCK ConveyorControl
  VAR_INPUT
    Enable : BOOL := FALSE;
    SpeedSetpoint : REAL := 50.0; (* Speed in percentage (0-100%) *)
    EmergencyStop : BOOL := FALSE;
    SensorItemPresent : BOOL := FALSE;
    SensorOverload : BOOL := FALSE;
    ResetFault : BOOL := FALSE;
  END_VAR

  VAR_OUTPUT
    Running : BOOL := FALSE;
    ActualSpeed : REAL := 0.0;
    Fault : BOOL := FALSE;
    FaultCode : INT := 0;
    (* Fault codes:
       0: No fault
       1: Overload
       2: Motor thermal protection
       3: Speed deviation
       4: Emergency stop *)
    ItemCount : DINT := 0;
  END_VAR

  VAR
    RampUpTimer : TON;
    OverloadTimer : TON;
    SpeedRampRate : REAL := 10.0; (* Percentage points per second *)
    TargetSpeed : REAL := 0.0;
    MotorTemperature : REAL := 25.0; (* Simulated motor temperature *)
    SpeedControlEnabled : BOOL := TRUE;
    LastSensorState : BOOL := FALSE;
  END_VAR

BEGIN
  (* Handle emergency stop *)
  IF EmergencyStop THEN
    TargetSpeed := 0.0;
    ActualSpeed := 0.0;
    Running := FALSE;
    Fault := TRUE;
    FaultCode := 4;
    RETURN;
  END_IF;

  (* Reset faults if requested *)
  IF ResetFault AND Fault THEN
    Fault := FALSE;
    FaultCode := 0;
  END_IF;

  (* Handle overload condition *)
  OverloadTimer(IN := SensorOverload, PT := T#2s);
  IF OverloadTimer.Q AND NOT Fault THEN
    Fault := TRUE;
    FaultCode := 1;
  END_IF;

  (* Don't run if in fault state *)
  IF Fault THEN
    TargetSpeed := 0.0;
    ActualSpeed := 0.0;
    Running := FALSE;
    RETURN;
  END_IF;

  (* Manage motor start/stop *)
  IF Enable AND NOT Running THEN
    (* Start ramp-up sequence *)
    TargetSpeed := SpeedSetpoint;
    Running := TRUE;
  ELSIF NOT Enable AND Running THEN
    (* Stop conveyor *)
    TargetSpeed := 0.0;
  END_IF;

  (* Speed ramp control *)
  IF Running THEN
    (* Gradually adjust actual speed toward target *)
    IF ActualSpeed < TargetSpeed THEN
      ActualSpeed := ActualSpeed + SpeedRampRate * 0.1; (* Assuming 100ms cycle time *)
      IF ActualSpeed > TargetSpeed THEN
        ActualSpeed := TargetSpeed;
      END_IF;
    ELSIF ActualSpeed > TargetSpeed THEN
      ActualSpeed := ActualSpeed - SpeedRampRate * 0.1;
      IF ActualSpeed < TargetSpeed THEN
        ActualSpeed := TargetSpeed;
      END_IF;
    END_IF;
  ELSE
    ActualSpeed := 0.0;
  END_IF;

  (* Update running state based on actual speed *)
  Running := ActualSpeed > 0.0;

  (* Simulate motor temperature based on speed and load *)
  IF Running THEN
    MotorTemperature := 25.0 + (ActualSpeed / 100.0) * 40.0;
    IF SensorOverload THEN
      MotorTemperature := MotorTemperature + 15.0;
    END_IF;
  ELSE
    (* Cool down when stopped *)
    MotorTemperature := MAX(25.0, MotorTemperature - 0.5);
  END_IF;

  (* Thermal protection *)
  IF MotorTemperature > 85.0 AND NOT Fault THEN
    Fault := TRUE;
    FaultCode := 2;
  END_IF;

  (* Count items passing by the sensor (rising edge detection) *)
  IF SensorItemPresent AND NOT LastSensorState AND Running THEN
    ItemCount := ItemCount + 1;
  END_IF;
  LastSensorState := SensorItemPresent;
END
END_FUNCTION_BLOCK

FUNCTION_BLOCK QualityStation
  VAR_INPUT
    Enable : BOOL := TRUE;
    ItemPresent : BOOL := FALSE;
    ItemType : ProductType := ProductType#Unknown;
    WeightValue : REAL := 0.0;
    DimensionX : REAL := 0.0;
    DimensionY : REAL := 0.0;
    DimensionZ : REAL := 0.0;
    ResetStats : BOOL := FALSE;
  END_VAR

  VAR_OUTPUT
    ItemAccepted : BOOL := FALSE;
    ItemRejected : BOOL := FALSE;
    RejectionReason : STRING := '';
    InspectionComplete : BOOL := FALSE;
    TotalInspected : DINT := 0;
    TotalAccepted : DINT := 0;
    TotalRejected : DINT := 0;
  END_VAR

  VAR
    WeightMin : ARRAY [1..3] OF REAL := [9.8, 24.5, 49.0];
    WeightMax : ARRAY [1..3] OF REAL := [10.2, 25.5, 51.0];
    DimXMin : ARRAY [1..3] OF REAL := [9.9, 19.9, 29.9];
    DimXMax : ARRAY [1..3] OF REAL := [10.1, 20.1, 30.1];
    DimYMin : ARRAY [1..3] OF REAL := [4.9, 9.9, 19.9];
    DimYMax : ARRAY [1..3] OF REAL := [5.1, 10.1, 20.1];
    DimZMin : ARRAY [1..3] OF REAL := [2.9, 3.9, 4.9];
    DimZMax : ARRAY [1..3] OF REAL := [3.1, 4.1, 5.1];

    ProcessingTimer : TON;
    PreviousItemPresent : BOOL := FALSE;
    ProcessingComplete : BOOL := FALSE;
    TypeIndex : INT := 0;
  END_VAR

BEGIN
  (* Reset stats if requested *)
  IF ResetStats THEN
    TotalInspected := 0;
    TotalAccepted := 0;
    TotalRejected := 0;
  END_IF;

  (* Detect new item for inspection *)
  IF ItemPresent AND NOT PreviousItemPresent AND Enable THEN
    (* Start inspection process *)
    InspectionComplete := FALSE;
    ItemAccepted := FALSE;
    ItemRejected := FALSE;
    RejectionReason := '';
    ProcessingComplete := FALSE;

    (* Set timer for inspection process *)
    ProcessingTimer(IN := TRUE, PT := T#800ms);
  END_IF;

  (* Inspection process *)
  IF ItemPresent AND NOT ProcessingComplete AND ProcessingTimer.Q THEN
    (* Determine product type index for array lookups *)
    CASE ItemType OF
      ProductType#TypeA: TypeIndex := 1;
      ProductType#TypeB: TypeIndex := 2;
      ProductType#TypeC: TypeIndex := 3;
      ELSE TypeIndex := 0;
    END_CASE;

    (* Perform inspection if we have a valid product type *)
    IF TypeIndex > 0 THEN
      TotalInspected := TotalInspected + 1;

      (* Check weight *)
      IF WeightValue < WeightMin[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Underweight';
      ELSIF WeightValue > WeightMax[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Overweight';

      (* Check X dimension *)
      ELSIF DimensionX < DimXMin[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'X dimension too small';
      ELSIF DimensionX > DimXMax[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'X dimension too large';

      (* Check Y dimension *)
      ELSIF DimensionY < DimYMin[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Y dimension too small';
      ELSIF DimensionY > DimYMax[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Y dimension too large';

      (* Check Z dimension *)
      ELSIF DimensionZ < DimZMin[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Z dimension too small';
      ELSIF DimensionZ > DimZMax[TypeIndex] THEN
        ItemRejected := TRUE;
        RejectionReason := 'Z dimension too large';

      (* If no rejections, accept the item *)
      ELSE
        ItemAccepted := TRUE;
        RejectionReason := '';
      END_IF;

      (* Update statistics *)
      IF ItemRejected THEN
        TotalRejected := TotalRejected + 1;
      ELSE
        TotalAccepted := TotalAccepted + 1;
      END_IF;
    ELSE
      (* Unknown product type *)
      ItemRejected := TRUE;
      RejectionReason := 'Unknown product type';
      TotalRejected := TotalRejected + 1;
      TotalInspected := TotalInspected + 1;
    END_IF;

    (* Mark inspection as complete *)
    InspectionComplete := TRUE;
    ProcessingComplete := TRUE;
  END_IF;

  (* Reset processing timer when item is removed *)
  IF NOT ItemPresent THEN
    ProcessingTimer(IN := FALSE);
  END_IF;

  (* Remember item presence for edge detection *)
  PreviousItemPresent := ItemPresent;
END
END_FUNCTION_BLOCK

PROGRAM ProductionLine
  VAR
    (* System components *)
    InfeedConveyor : ConveyorControl;
    MainConveyor : ConveyorControl;
    OutfeedConveyor : ConveyorControl;
    QualityCheck : QualityStation;

    (* Sensors *)
    SensorInfeedStart : BOOL := FALSE;
    SensorInfeedEnd : BOOL := FALSE;
    SensorQCPosition : BOOL := FALSE;
    SensorOutfeedStart : BOOL := FALSE;
    SensorOutfeedEnd : BOOL := FALSE;

    (* Production parameters *)
    ProductionActive : BOOL := FALSE;
    SystemSpeed : REAL := 75.0; (* Overall speed setting (0-100%) *)
    EmergencyStopActive : BOOL := FALSE;
    CurrentProduct : ProductType := ProductType#TypeA;

    (* System values *)
    ProductWeight : REAL := 10.0;
    ProductDimX : REAL := 10.0;
    ProductDimY : REAL := 5.0;
    ProductDimZ : REAL := 3.0;

    (* Sequence control *)
    SequenceStep : INT := 0;
    SequenceTimer : TON;

    (* Statistics *)
    Stats : ProductionStats;
    StatUpdateTimer : TON;
    LastUpdateTime : TIME;
    ProductionStartTime : TIME;
    CurrentTime : TIME;
    RunningTime : TIME;
  END_VAR

BEGIN
  (* Handle emergency stop *)
  IF EmergencyStopActive THEN
    ProductionActive := FALSE;
  END_IF;

  (* Update conveyors *)
  InfeedConveyor(
    Enable := ProductionActive,
    SpeedSetpoint := SystemSpeed,
    EmergencyStop := EmergencyStopActive,
    SensorItemPresent := SensorInfeedStart
  );

  MainConveyor(
    Enable := ProductionActive,
    SpeedSetpoint := SystemSpeed,
    EmergencyStop := EmergencyStopActive,
    SensorItemPresent := SensorInfeedEnd
  );

  OutfeedConveyor(
    Enable := ProductionActive AND QualityCheck.ItemAccepted,
    SpeedSetpoint := SystemSpeed,
    EmergencyStop := EmergencyStopActive,
    SensorItemPresent := SensorOutfeedStart
  );

  (* Quality check station *)
  QualityCheck(
    Enable := ProductionActive,
    ItemPresent := SensorQCPosition,
    ItemType := CurrentProduct,
    WeightValue := ProductWeight,
    DimensionX := ProductDimX,
    DimensionY := ProductDimY,
    DimensionZ := ProductDimZ
  );

  (* Update production statistics *)
  IF QualityCheck.InspectionComplete AND QualityCheck.ItemAccepted THEN
    Stats.TotalProduced := Stats.TotalProduced + 1;

    CASE CurrentProduct OF
      ProductType#TypeA: Stats.TypeACount := Stats.TypeACount + 1;
      ProductType#TypeB: Stats.TypeBCount := Stats.TypeBCount + 1;
      ProductType#TypeC: Stats.TypeCCount := Stats.TypeCCount + 1;
    END_CASE;
  END_IF;

  IF QualityCheck.InspectionComplete AND QualityCheck.ItemRejected THEN
    Stats.RejectedCount := Stats.RejectedCount + 1;
  END_IF;

  (* Calculate production rate every 10 seconds *)
  StatUpdateTimer(IN := TRUE, PT := T#10s);
  IF StatUpdateTimer.Q THEN
    (* Calculate rate as items per minute *)
    IF LastUpdateTime > T#0s THEN
      CurrentTime := CurrentTime + T#10s; (* Simulated time *)
      RunningTime := CurrentTime - ProductionStartTime;

      IF RunningTime > T#0s THEN
        (* Calculate efficiency and rate *)
        Stats.CurrentRate := REAL_TO_REAL(Stats.TotalProduced) * 60.0 / TIME_TO_REAL(RunningTime);
        Stats.LineEfficiency := 100.0 * REAL_TO_REAL(Stats.TotalProduced) /
                               (REAL_TO_REAL(Stats.TotalProduced) + REAL_TO_REAL(Stats.RejectedCount));
      END_IF;
    END_IF;

    LastUpdateTime := CurrentTime;
    StatUpdateTimer(IN := FALSE);
  END_IF;

  (* Simulate production sequence (in a real system, these would be physical sensors) *)
  CASE SequenceStep OF
    0: (* Waiting for start *)
      IF ProductionActive THEN
        SequenceStep := 1;
        ProductionStartTime := CurrentTime;
      END_IF;

    1: (* Generate product at infeed *)
      SensorInfeedStart := TRUE;
      SequenceTimer(IN := TRUE, PT := T#2s);
      IF SequenceTimer.Q THEN
        SequenceTimer(IN := FALSE);
        SequenceStep := 2;
      END_IF;

    2: (* Move to main conveyor *)
      SensorInfeedStart := FALSE;
      SensorInfeedEnd := TRUE;
      SequenceTimer(IN := TRUE, PT := T#3s);
      IF SequenceTimer.Q THEN
        SequenceTimer(IN := FALSE);
        SequenceStep := 3;
      END_IF;

    3: (* Move to quality check *)
      SensorInfeedEnd := FALSE;
      SensorQCPosition := TRUE;
      SequenceTimer(IN := TRUE, PT := T#5s);
      IF SequenceTimer.Q THEN
        SequenceTimer(IN := FALSE);
        SequenceStep := 4;
      END_IF;

    4: (* Quality check complete, move to outfeed if accepted *)
      SensorQCPosition := FALSE;
      IF QualityCheck.ItemAccepted THEN
        SensorOutfeedStart := TRUE;
        SequenceStep := 5;
      ELSE
        (* Rejected item handling would go here *)
        SequenceStep := 7; (* Skip to next product *)
      END_IF;

    5: (* Move to outfeed end *)
      SequenceTimer(IN := TRUE, PT := T#2s);
      IF SequenceTimer.Q THEN
        SequenceTimer(IN := FALSE);
        SensorOutfeedStart := FALSE;
        SensorOutfeedEnd := TRUE;
        SequenceStep := 6;
      END_IF;

    6: (* Complete product cycle *)
      SequenceTimer(IN := TRUE, PT := T#1s);
      IF SequenceTimer.Q THEN
        SequenceTimer(IN := FALSE);
        SensorOutfeedEnd := FALSE;
        SequenceStep := 7;
      END_IF;

    7: (* Generate next product or type *)
      (* Randomly change product type for demonstration (in a real system this would be based on production plan) *)
      (* This is just a simple simulation *)
      IF Stats.TotalProduced MOD 5 = 0 THEN
        CurrentProduct := ProductType#TypeB;
        ProductWeight := 25.0;
        ProductDimX := 20.0;
        ProductDimY := 10.0;
        ProductDimZ := 4.0;
      ELSIF Stats.TotalProduced MOD 11 = 0 THEN
        CurrentProduct := ProductType#TypeC;
        ProductWeight := 50.0;
        ProductDimX := 30.0;
        ProductDimY := 20.0;
        ProductDimZ := 5.0;
      ELSE
        CurrentProduct := ProductType#TypeA;
        ProductWeight := 10.0;
        ProductDimX := 10.0;
        ProductDimY := 5.0;
        ProductDimZ := 3.0;
      END_IF;

      (* Occasionally introduce defects for testing *)
      IF Stats.TotalProduced MOD 7 = 0 THEN
        (* Weight defect *)
        ProductWeight := ProductWeight * 1.1;
      END_IF;

      SequenceStep := 1; (* Restart sequence *)
  END_CASE;
END
END_PROGRAM
