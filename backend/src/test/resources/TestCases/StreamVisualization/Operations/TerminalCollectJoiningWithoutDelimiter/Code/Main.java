import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.DoubleStream;
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        var result = Stream.of("a", "b", "c").map(s -> s.toUpperCase()).collect(Collectors.joining());
        System.out.println(result);
    }
}
