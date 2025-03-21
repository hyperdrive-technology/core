# Audio Volume Controller Example

This example demonstrates a more complex IEC 61131-3 function block for controlling audio volume with balance adjustment. The code showcases several important features of the IEC 61131-3 standard:

## Key Features

1. **Function Block with Multiple Variable Types**:
   - VAR_INPUT: Input variables (balance control, volume control, and model type selector)
   - VAR_OUTPUT: Output variables (amplifier control values and LED status)
   - VAR_IN_OUT: In/Out variables (critical status flag)
   - VAR: Internal variables (maximum value, timer, overdrive status)

2. **Function Definition**:
   - The `Norm` function handles the calculation of amplifier values
   - Custom data type with initialization (`CalType`)
   - Parameter passing with named arguments

3. **Advanced Operators and Functions**:
   - Type conversion with `SINT_TO_REAL`
   - Mathematical functions: `ABS`, `MAX`
   - Selection operation with `SEL` function
   - Structured data access with dot notation (e.g., `HeatTime.Q`)

4. **Timer Functions**:
   - Usage of the standard `TON` (timer on-delay) function block
   - Time literals with `T#2s` syntax

## Usage

The Volume function block processes balance and volume control inputs to calculate the appropriate output values for left and right audio amplifiers. It includes overdrive protection that activates a warning LED if the amplifier output exceeds the maximum value for more than 2 seconds.

This example is particularly useful for demonstrating how to implement controls for audio equipment or similar systems with dual-channel output requirements.
