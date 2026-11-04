import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        Stream.of(1, 2, 3)
                .mapToLong(n -> n * 1000L)
                .forEach(System.out::println);
    }
}
