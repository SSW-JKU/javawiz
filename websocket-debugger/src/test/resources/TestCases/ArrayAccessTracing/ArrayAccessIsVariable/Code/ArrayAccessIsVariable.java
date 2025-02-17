public class ArrayAccessIsVariable {
    public static void main(String[] args) {
        int[] xs = new int[]{0,1,2,3,4,5,6,7,8,9};
        int i = 2;
        int j = 3;
        xs[i]++;
        xs[i+j]++;
        xs[i++]++;
        xs[j] += xs[1];
    }
}