FUNCTION_BLOCK Volume
VAR_INPUT
    BalControl:     SINT (-5..5);     (* balance control with integer range -5 to 5 *)
    VolControl:     SINT (0..10);     (* volume control with integer range 0 to 10 *)
    ModelType:      BOOL;             (* 2 model types; TRUE or FALSE *)
END_VAR
VAR_OUTPUT
    RightAmplif:    REAL;             (* control variable for the right amplifier *)
    LeftAmplif:     REAL;             (* control variable for the left amplifier *)
    LED:            BOOL;             (* warning LED on: 1; off: FALSE *)
END_VAR
VAR_IN_OUT
    Critical:       BOOL;             (* return value *)
END_VAR
VAR
    MaxValue:       REAL := 26.0;     (* max. amplifier input; active for a defined time: *)
                                      (* turn on the warning LED *)
    HeatTime:       TON;              (* standard FB (time delay) to control *)
                                      (* the overdrive time *)
    Overdrive:      BOOL;             (* overdrive status *)
END_VAR

(* Control of the right amplifier
depending on the volume and balance control settings *)
RightAmplif :=  Norm (    LCtrlK := VolControl,
                          BlK := BalControl+5,
                          MType := ModelType);

(*Control of the left amplifier,
balance control knob behaves in reverse to that of the right amplifier*)
LeftAmplif :=   Norm (    LCtrlK := VolControl,
                          BlK := ABS(BalControl - 5),
                          MType := ModelType);

(* Overdrive ? *)
IF MAX(LeftAmplif, RightAmplif) >= MaxValue
THEN
    Overdrive := TRUE;
ELSE
    Overdrive := FALSE;
END_IF;

(* Overdrive for more than 2 seconds? *)
HeatTime (IN := Overdrive, PT := T#2s);

LED := HeatTime.Q;
IF HeatTime.Q = TRUE THEN
    Critical := 1;
END_IF;
END_FUNCTION_BLOCK


FUNCTION Norm: REAL
VAR_INPUT
    BlK:         SINT;     (* scaled balance control *)
    LCtrlK:      SINT;     (* volume control *)
    MType:       BOOL;     (* 2 types; described by TRUE or FALSE *)
END_VAR
TYPE
    CalType : REAL := 5.0; (* data type with special initial value *)
END_TYPE
VAR
    Calib:        CalType; (*Scaling value for amplifier output; initialised with 5.0 *)
END_VAR

(* Evaluate real numbers for the amplifiers depending on model and control knob settings *)
Norm :=    SINT_TO_REAL(BlK) +               (* take the balance value *)
           Calib +                           (* add scaling value *)
           SEL(G := MType, IN0 := 4.0, IN1 := 6.0) +   (* model-specific scaling value *)
           SINT_TO_REAL(LCtrlK);             (* add the volume value *)

END_FUNCTION
