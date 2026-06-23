import { TRANSFORMATION } from '@/helpers/constants'
import { Selection } from 'd3-selection'

/**
 * applies blend-in animation
 * @param selection selection that should be blended in
 * @param max maximum opacity
 * @param duration duration of animation
 */
export function blendInAnimation (selection: any, max: string = '1', duration: number = TRANSFORMATION.duration) {
  selection.style('opacity', '0')
    .transition()
    .duration(duration)
    .ease(TRANSFORMATION.ease)
    .style('opacity', max)
}

/**
 * applies blend-out animation
 * @param selection selection that should be blended out
 * @param duration duration of animation
 */
export function blendOutAnimation (selection: Selection<any, any, any, any>, duration: number = TRANSFORMATION.duration) {
  selection
    .transition()
    .duration(duration)
    .ease(TRANSFORMATION.ease)
    .style('opacity', '0')
    .transition()
    .remove()
}
