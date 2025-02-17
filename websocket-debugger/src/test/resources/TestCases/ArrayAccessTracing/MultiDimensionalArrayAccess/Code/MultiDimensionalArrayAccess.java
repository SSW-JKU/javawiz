public class MultiDimensionalArrayAccess {
    static int count = 0; // make sure nothing gets instrumented multiple times

    static int count2 = 0;
    static int count3 = 0;
    public static void main(String[] args) {
        int[] a = new int[]{1, 2, 3};
        a[1] = a[2];
        a[count] = a[count+1];
        a[count++] =
                (a[count]
                        = a[++count]);


        count2 += foo()[0];

        int[][] b = new int[][]{
                new int[]{1, 2, 3},
                new int[]{4, 5, 6},
                new int[]{7, 8, 9}
        };

        count2 += b[1][2];
        b[2][1] += count2;
        System.out.println(
         ++b[
         bar()
        ][
         a[2] = 0
        ]);


        System.out.println(count);
        System.out.println(count2);
        System.out.println(count3);
    }

    static int[] foo() {
        count++;
        int[] result = new int[]{1, 2, 3};
        result[1] = result[2];
        return result;
    }

    static int bar() {
        count3 += 143;
        return 1;
    }
}