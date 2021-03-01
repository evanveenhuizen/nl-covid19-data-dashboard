import { scaleBand, scaleLinear } from '@visx/scale';
import { extent } from 'd3-array';
import { useMemo } from 'react';
import { isDefined } from 'ts-is-present';
import { Bounds } from './common';
import {
  SeriesDoubleValue,
  SeriesItem,
  SeriesList,
  SeriesSingleValue,
} from './series';

export function useScales(args: {
  seriesList: SeriesList;
  maximumValue: number;
  bounds: Bounds;
  numTicks: number;
}) {
  const { seriesList, maximumValue, bounds, numTicks } = args;

  return useMemo(() => {
    /**
     * We could calculate the x domain based on the original values too, but in
     * the trends the timestamps are already unified for daily data and date
     * spans like weeks. The week timestamp then falls in the middle of the
     * week.
     */
    const [start, end] = extent(seriesList.flat().map((x) => x.__date_unix));

    const xDomain =
      isDefined(start) && isDefined(end) ? [start, end] : undefined;

    const yDomain = [0, maximumValue];

    /**
     * To calculate the timespan width we need a full series worth of
     * timestamps. This chart assumes that all series have the same length
     * because they all originate from the same T[] values. If a trend is not
     * full-length it should contain null values, but still have all the
     * timestamps.
     */
    const timespanMarkerData = seriesList[0] as SeriesItem[];
    /**
     * ☝️ weird. Typescript 4.3 doesn't complain below when mapping over the
     * data, but TS 4.2 thinks x is any. So I'm just leaving this cast to
     * SeriesItem until 4.3 comes along as the official version.
     */
    const dateSpanScale = scaleBand<number>({
      range: [0, bounds.width],
      domain: timespanMarkerData.map((x) => x.__date_unix),
    });

    const markerPadding = dateSpanScale.bandwidth() / 2;

    const xScale = scaleLinear({
      domain: xDomain,
      range: [markerPadding, bounds.width - markerPadding],
    });

    const yScale = scaleLinear({
      domain: yDomain,
      range: [bounds.height, 0],
      nice: numTicks,
    });

    const getX = (x: SeriesItem) => xScale(x.__date_unix);

    const getY = (x: SeriesSingleValue) => yScale(x.__value);
    const getY0 = (x: SeriesDoubleValue) => yScale(x.__value_a);
    const getY1 = (x: SeriesDoubleValue) => yScale(x.__value_b);

    return {
      xScale,
      yScale,
      getX,
      getY,
      getY0,
      getY1,
      dateSpanWidth: dateSpanScale.bandwidth(),
    };
  }, [seriesList, maximumValue, bounds, numTicks]);
}
