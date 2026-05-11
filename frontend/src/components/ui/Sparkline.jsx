import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export default function Sparkline({ data, color = '#3B5AFB', height = 36, tooltipName = '趋势' }) {
  const values = useMemo(() => (Array.isArray(data) ? data.map(v => Number(v) || 0) : []), [data]);
  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: params => `${tooltipName}: ${params?.[0]?.value ?? '-'}`,
    },
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    xAxis: { type: 'category', show: false, data: values.map((_, idx) => idx) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.8, color },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${color}33` },
          { offset: 1, color: `${color}00` },
        ]),
      },
    }],
  }), [values, color, tooltipName]);

  if (!values.length) return null;
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height, width: '100%' }} notMerge />;
}
