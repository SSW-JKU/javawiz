import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        IntStream.of(1, 2, 3)
                .mapToObj(n -> "#" + n)
                .forEach(System.out::println);
    }
}
