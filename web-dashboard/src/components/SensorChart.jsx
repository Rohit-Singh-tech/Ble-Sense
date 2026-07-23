import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const SensorChart = ({ data }) => {
  // We format the raw packets to be friendly for Recharts
  const formattedData = data.map((packet, index) => {
    // Recharts likes flat objects
    // Assuming the android app sends something like:
    // { timestamp: "...", data: { temperature: 25, heartRate: 80 } }
    
    const time = new Date(packet.timestamp).toLocaleTimeString();
    
    // Flatten the internal data payload 
    let payload = typeof packet.data === 'object' ? packet.data : { rawValue: packet.data };

    // Scale accelerometer values for chart display
    const scaledPayload = { ...payload };
    ['accel_x', 'accel_y', 'accel_z'].forEach(key => {
      if (typeof scaledPayload[key] === 'number') {
        const val = scaledPayload[key];
        if (val === 255) {
          scaledPayload[key] = null; // Don't plot invalid/empty samples
        } else {
          const signed = val > 127 ? val - 256 : val;
          scaledPayload[key] = parseFloat((signed / 6.4).toFixed(3));
        }
      }
    });
    
    return {
      name: time,
      timestampVal: new Date(packet.timestamp).getTime(),
      ...scaledPayload
    };
  }).reverse(); // Reverse so chronologically oldest is on left

  if (!formattedData || formattedData.length === 0) {
    return <div>No chart data available</div>;
  }

  // To dynamically create lines based on the keys sent from the App
  // Let's explicitly look at ALL items and collect all numeric keys
  const dataKeysSet = new Set();
  formattedData.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== 'name' && key !== 'timestampVal' && key !== 'packetId' && key !== '_id' && typeof item[key] === 'number') {
        dataKeysSet.add(key);
      }
    });
  });
  const dataKeys = Array.from(dataKeysSet);

  // Modern nice colors for the lines
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F'];

  // Safety fallback if no numeric data found
  if (dataKeys.length === 0) {
    return <div style={{ color: 'var(--text-main)' }}>Receiving data, but no numeric sensor metrics found to chart yet.</div>;
  }

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <LineChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="name" stroke="var(--text-secondary)" />
          <YAxis stroke="var(--text-secondary)" />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--card-border)', color: 'var(--text-main)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--text-main)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
          {dataKeys.map((key, index) => (
            <Line 
              key={key}
              type="monotone" 
              dataKey={key} 
              stroke={colors[index % colors.length]} 
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 8 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;
