import React from 'react';

interface TrafficLightsProps {
  plcVariables?: Record<string, any>;
}

export default function TrafficLights({
  plcVariables = {},
}: TrafficLightsProps) {
  // Extract traffic light states from PLC variables
  const redLight = Boolean(plcVariables.RedLight);
  const yellowLight = Boolean(plcVariables.YellowLight);
  const greenLight = Boolean(plcVariables.GreenLight);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex flex-col items-center space-y-2">
        {/* Red Light */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            redLight
              ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.7)]'
              : 'bg-red-900'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-red-600/20" />
        </div>

        {/* Yellow Light */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            yellowLight
              ? 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.7)]'
              : 'bg-yellow-900'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-yellow-400/20" />
        </div>

        {/* Green Light */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            greenLight
              ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.7)]'
              : 'bg-green-900'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-green-500/20" />
        </div>
      </div>

      {/* Debug Values */}
      <div className="mt-4 text-xs text-gray-400">
        <div>Red: {String(redLight)}</div>
        <div>Yellow: {String(yellowLight)}</div>
        <div>Green: {String(greenLight)}</div>
      </div>
    </div>
  );
}
