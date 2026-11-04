import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        Stream.of(1, 2, 3, 4)
                .filter(n -> n % 2 == 0)
                .forEach(System.out::println);
    }
}
