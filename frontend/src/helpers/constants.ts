import { easeCubic } from 'd3'

export const DEFAULT_FILE_NAME = 'HelloWorld.java'
export const DEFAULT_EDITOR_TEXT = [
  'public class HelloWorld {',
  '  public static void main(String[] args) {',
  '    System.out.println("Hello world!");',
  '    int a = 10;',
  '    int b = 20;',
  '    a = 20;',
  '    System.out.println("Hello world again!");',
  '    int c = 30;',
  '  }',
  '}'
].join('\n')

export const TRANSFORMATION = {
  duration: 1200,
  ease: easeCubic
}

export const DEFAULT_ZOOM_FACTOR = 1.3
