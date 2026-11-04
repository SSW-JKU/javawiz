import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.DoubleStream;
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        var result = Stream.of(1, 2, 3, 4).map(n -> n * 2).collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        System.out.println(result);
    }
}
