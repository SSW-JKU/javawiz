public class ArrayAccessIsAssignmentTarget {
    public static void main(String[] args) {
        int[] xs = new int[]{0,1,2,3,4,5,6,7};
        xs[0] = xs[1];
        xs[2]++;
        xs[3] = (xs[4] = xs[5]);
        xs[6] *= 2;
        /*
        * 0 ... assignment
        * 1 ... no assignment
        * 2 ... no assignment
        * 3 ... assignment
        * 4 ... assignment
        * 5 ... no assignment
        * 6 ... assignment
        * */
    }
}