public class Shapes {

    private static final int DIST = 10;

    public static void main(String[] args) {

        Shape hat1 = new Rect(130, 120, 40, 10);
        Shape hat2 = new Rect(140, 90, 20, 30);
        Group hat = new Group(hat1, hat2);

        Rect legL = new Rect(100, 300, 45, 100);
        Rect legR = new Rect(155, 300, 45, 100);
        Rect armL = new Rect(60, 210, 40, 30);
        Rect armR = new Rect(200, 210, 40, 30);
        Circle body = new Circle(150, 250, 60);
        Circle head = new Circle(150, 160, 30);

        Group snowMan = new Group(hat, armL, armR, legR, legL, head, body);

        Out.println(snowMan.getLeft() + snowMan.getWidth());
        snowMan.draw();

    }
}

class Shape {

    /**
     * Gets the left coordinate of this shape.
     *
     * @return the left coordinate
     */
    public int getLeft() {return 0;}

    /**
     * Gets the top coordinate of this shape.
     *
     * @return the top coordinate
     */
    public int getTop() {return 0;}

    /**
     * Gets the width of this shape.
     *
     * @return the width
     */
    public int getWidth() {return 0;}

    /**
     * Gets the height of this shape.
     *
     * @return the height
     */
    public int getHeight() {return 0;}

    /**
     * Draws this element on Window
     */
    public void draw(){}

}

class Primitive extends Shape {

    /** x-coordinate of the figure. */
    private final int x;
    /** y-coordinate of the figure. */
    private final int y;

    /**
     * Constructor initializing position of graphical object.
     *
     * @param x x coordinate
     * @param y y coordinate
     */
    public Primitive(int x, int y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Gets the x-coordinate of this object.
     *
     * @return the x-coordinate
     */
    public int getX() {
        return x;
    }

    /**
     * Gets the y-coordinate of this object.
     *
     * @return the y-coordinate
     */
    public int getY() {
        return y;
    }

}

class Rect extends Primitive {

    /** Width of the rectangle. */
    private final int width;

    /** Height of the rectangle. */
    private final int height;

    /**
     * Constructor initalizing position, width and heigth.
     *
     * @param x      the x-coordinate of the position
     * @param y      the y-coordinate of the position
     * @param width  the width of this rectangle
     * @param height the heigth of this rectangle
     */
    public Rect(int x, int y, int width, int height) {
        super(x, y);
        this.width = width;
        this.height = height;
    }

    @Override
    public int getLeft() {
        return getX();
    }

    @Override
    public int getTop() {
        return getY();
    }

    @Override
    public int getWidth() {
        return width;
    }

    @Override
    public int getHeight() {
        return height;
    }

    @Override
    public void draw() {
        Out.println(String.format("Rect[%d,%d,%d,%d]", getX(), getY(), getWidth(), getHeight()));
    }

}

class Circle extends Primitive {

    /** Radius of the circle. */
    private final int radius;

    /**
     * Constructor initializing position and radius.
     *
     * @param x      the x-coordinate of the position
     * @param y      the y-coordinate of the position
     * @param radius the radius of this circle
     */
    public Circle(int x, int y, int radius) {
        super(x, y);
        this.radius = radius;
    }

    /**
     * Gets the radius of this circle.
     *
     * @return the radius
     */
    public int getRadius() {
        return radius;
    }

    @Override
    public int getLeft() {
        return getX() - radius;
    }

    @Override
    public int getTop() {
        return getY() - radius;
    }

    @Override
    public int getWidth() {
        return radius * 2;
    }

    @Override
    public int getHeight() {
        return radius * 2;
    }

    @Override
    public void draw() {
        Out.println(String.format("Circle[%d,%d,%d]", getX(), getY(), getRadius()));
    }

}

class Group extends Shape {

    private final Shape[] subShapes;

    public Group(Shape... subShapes) {
        this.subShapes = subShapes;
    }

    public Shape[] getSubshapes() {
        return subShapes.clone();
    }

    @Override
    public int getLeft() {
        int min = Integer.MAX_VALUE;
        for (Shape s : subShapes) {
            if (s.getLeft() < min) {
                min = s.getLeft();
            }
        }
        return min;
    }

    @Override
    public int getTop() {
        int min = Integer.MAX_VALUE;
        for (Shape s : subShapes) {
            if (s.getTop() < min) {
                min = s.getTop();
            }
        }
        return min;
    }

    @Override
    public int getWidth() {
        int right = 0;
        for (Shape sub : subShapes) {
            int subRight = sub.getLeft() + sub.getWidth();
            if (right < subRight) {
                right = subRight;
            }
        }
        return right - getLeft();
    }

    @Override
    public int getHeight() {
        int bottom = 0;
        for (Shape sub : subShapes) {
            int subBottom = sub.getTop() + sub.getHeight();
            if (bottom < subBottom) {
                bottom = subBottom;
            }
        }
        return bottom - getTop();
    }

    @Override
    public void draw() {
        for (Shape s : subShapes) {
            s.draw();
        }
    }

}