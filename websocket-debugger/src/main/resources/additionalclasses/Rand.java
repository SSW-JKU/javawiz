import java.util.Random;
import java.util.function.IntPredicate;

public class Rand {

    private static Random rand = new Random(); 

    /**
     * Returns a random integer value. the values are in the full range of int type, 
     * including negative values. 
     * 
     * @return random integer value
     */
    public static int randInt() {
        return rand.nextInt(); 
    }

    /**
     * Returns a random integer value between 0 and {@code upperBound}. 0 is included, upperBound is excluded. 
     * @param bound
     * @return a random integer value between 0 and {@code upperBound} (exclusive). 
     */
    public static int randInt(int upperBound) {
        return rand.nextInt(upperBound); 
    }

    /**
     * Returns a random integer value between {@code lower} (inclusive) and {@code upper} (exclusive) bounds.  
     * @param bound
     * @return a random integer value between {@code lower} and {@code upper} (exclusive) . 
     */
    public static int randInt(int lower, int upper) {
        return (int) (rand.nextDouble() * (upper - lower) + lower); 
    }

   /**
     * Returns a random even integer value between {@code lower} (inclusive) and {@code upper} (exclusive) bounds.  
     * @param lower the lower bound for the numbers (inclusive)
     * @param upper the upper bound for the numbers (exclusive)
     * @return a random even integer value between {@code lower} and {@code upper} (exclusive) . 
     */
    public static int randEven(int lower, int upper) {
        return randInt(lower, upper, x -> x % 2 == 0); 
    }

  /**
     * Returns a random odd integer value between {@code lower} (inclusive) and {@code upper} (exclusive) bounds.  
     * @param lower the lower bound for the numbers (inclusive)
     * @param upper the upper bound for the numbers (exclusive)
     * @return a random odd integer value between {@code lower} and {@code upper} (exclusive) . 
     */
    public static int randOdd(int lower, int upper) {
        return randInt(lower, upper, x -> x % 2 != 0); 
    }

   /**
     * Returns a random  integer value between {@code lower} (inclusive) and {@code upper} (exclusive) bounds
     * which fullfills the given predicate .  
     * @param lower the lower bound for the numbers (inclusive)
     * @param upper the upper bound for the numbers (exclusive)
     * @param test the test function for testing the values 
    * @return a random  integer value between {@code lower} and {@code upper} (exclusive) fulfilling the test. 
     */
    public static int randInt(int lower, int upper, IntPredicate test) {
        int x = randInt(lower, upper);
        while (! test.test(x)) {
            x = randInt(lower, upper); 
        }
        return x; 
    }
    
}
