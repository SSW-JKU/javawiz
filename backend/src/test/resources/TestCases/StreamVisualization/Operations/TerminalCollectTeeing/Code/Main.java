import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.DoubleStream;
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        var result = Stream.of(1, 2, 3, 4).map(n -> n * 2).collect(Collectors.teeing(Collectors.counting(), Collectors.summingInt(n -> n), (c, s) -> s + "/" + c));
        System.out.println(result);
    }
}
