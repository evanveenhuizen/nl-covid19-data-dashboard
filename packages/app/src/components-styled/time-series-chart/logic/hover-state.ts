import { TimestampedValue } from '@corona-dashboard/common';
import { localPoint } from '@visx/event';
import { Point } from '@visx/point';
import { bisectLeft } from 'd3-array';
import { ScaleTime } from 'd3-scale';
import { useCallback, useState } from 'react';
import { TrendValue } from '~/components-styled/line-chart/logic';
import { SeriesConfig } from './series';

export type HoveredPoint = {
  trendValue: TrendValue;
  /**
   * Values index is used to look up the original value from the values prop
   * based on the bisect outcome (a HoveredPoint).
   */
  valuesIndex: number;
  /**
   * The series config index is used to link a point to the seriesConfig to look
   * up things like color and type.
   */
  seriesConfigIndex: number;
  /**
   * Color should be redundant here due to the seriesConfigIndex property
   */
  color: string;
  /**
   * The position of the point on the overlay
   */
  x: number;
  y: number;
};

interface UseHoverStateArgs<T extends TimestampedValue> {
  trendsList: TrendValue[][];
  seriesConfig: SeriesConfig<T>[];
  getX: (v: TrendValue) => number;
  getY: (v: TrendValue) => number;
  paddingLeft: number;
  xScale: ScaleTime<number, number>;
}

interface HoverState {
  points: HoveredPoint[];
  nearestPoint: HoveredPoint;
}

type Event = React.TouchEvent<SVGElement> | React.MouseEvent<SVGElement>;

type HoverHandler = (event: Event, seriesIndex?: number) => void;

type UseHoveStateResponse = [HoverHandler, HoverState | undefined];

export function useHoverState<T extends TimestampedValue>({
  // values,
  trendsList,
  seriesConfig,
  getX,
  getY,
  paddingLeft,
  xScale,
}: UseHoverStateArgs<T>): UseHoveStateResponse {
  const [hoverState, setHoverState] = useState<HoverState>();

  /**
   * @TODO we only really have to do bisect once on original values object,
   * because all points of all trends are always coming from those values and
   * are thus aligned vertically.
   */
  const bisect = useCallback(
    function (trend: TrendValue[], xPosition: number): [TrendValue, number] {
      if (trend.length === 1) return [trend[0], 0];

      /**
       * @TODO figure this out. If we can do it without padding, we can move
       * this outside the component
       */
      const date = xScale.invert(xPosition - paddingLeft);

      const index = bisectLeft(
        trend.map((x) => x.__date),
        date,
        1
      );

      const d0 = trend[index - 1];
      const d1 = trend[index];

      if (!d1) return [d0, 0];

      return [+date - +d0.__date > +d1.__date - +date ? d1 : d0, index];
    },
    [paddingLeft, xScale]
  );

  const handleHover = useCallback(
    (event: Event) => {
      if (event.type === 'mouseleave') {
        setHoverState(undefined);
      }

      const mousePoint = localPoint(event);

      if (!mousePoint) {
        return;
      }

      /**
       * @TODO flip this around and do bisect on "values" instead of "trends"
       * We can construct the points from the seriesConfig
       */
      const points = trendsList.map((trend, index) => {
        /**
         * @TODO we only really need to do the bisect once on a single trend
         * because all trend values come from the same original value object
         */
        const [trendValue, trendValueIndex] = bisect(trend, mousePoint.x);

        return {
          trendValue,
          trendValueIndex,
          seriesConfigIndex: index,
          /**
           * @TODO I don't think we need to include color here. Can we derive
           * active hover point index maybe if we pass that to the markers component?
           */
          color: seriesConfig[index].color,
          x: getX(trendValue),
          y: getY(trendValue),
        } as HoveredPoint;
      });

      // console.log('points', points);

      const nearestPoint = [...points].sort(
        (left, right) =>
          distance(left, mousePoint) - distance(right, mousePoint)
      )[0];

      // const nearestPoint = sortedPoints[0];

      setHoverState({ points, nearestPoint });
    },
    [bisect, trendsList, seriesConfig, getX, getY]
  );

  return [handleHover, hoverState];
}

const distance = (hoveredPoint: HoveredPoint, localPoint: Point) => {
  /**
   * @TODO rewrite this to getX getY
   *
   * can use use vix standard function for distance?
   *
   * we probably only need to look at the Y component, because all trend
   * values come from the same sample, and that sample has been picked with
   * the bisect call.
   */
  const x = localPoint.x - hoveredPoint.x;
  const y = localPoint.y - hoveredPoint.y;
  return Math.sqrt(x * x + y * y);
};
