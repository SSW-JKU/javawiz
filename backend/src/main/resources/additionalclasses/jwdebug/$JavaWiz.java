package jwdebug;
import java.util.Comparator;
import java.util.function.*;
import java.util.stream.Collector;
import java.util.Map;
import java.util.Iterator;
import java.util.Collection;
import java.util.stream.Collectors;
import java.util.Arrays;

public class $JavaWiz {
    public static boolean recordCondition(boolean value, int conditionId) {
        return value;
    }

    public static int recordArrayAccess(Object array, int index, int arrayAccessId, int dimension) {
        return index;
    }

    public static void traceStream(String direction, Object elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, Object elem, String name, int id, int streamId, String param, String value) {}
    public static void traceStream(String direction, String elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, int elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, long elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, double elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, float elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, char elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, byte elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, short elem, String name, int id, int streamId, String param) {}
    public static void traceStream(String direction, boolean elem, String name, int id, int streamId, String param) {}

    public static <T, A, R> Collector<T, A, R> traceParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            Collector<T, A, R> base
    ) {
        return Collector.of(
                base.supplier(),
                (acc, t) -> {
                    String stateBefore = stateToString(acc);
                    base.accumulator().accept(acc, t);
                    if (!stateBefore.equals(stateToString(acc))) {
                        traceStream("END", acc, name, id, streamId, paramAsString, acc.toString());
                    } else {
                        traceStream("NOP", acc, name, id, streamId, paramAsString, acc.toString());
                    }
                },
                base.combiner(),
                base.finisher(),
                base.characteristics().toArray(new Collector.Characteristics[0])
        );
    }
    public static <T, R> Collector<T, R, R> traceParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            Supplier<R> supplier,
            BiConsumer<R, ? super T> accumulator,
            BiConsumer<R, R> combiner
    ) {
        return Collector.of(
                supplier,
                (acc, t) -> {
                    String stateBefore = stateToString(acc);
                    accumulator.accept(acc, t);
                    if (!stateBefore.equals(stateToString(acc))) {
                        traceStream("END", acc, name, id, streamId, paramAsString, acc.toString());
                    } else {
                        traceStream("NOP", acc, name, id, streamId, paramAsString, acc.toString());
                    }
                },
                (left, right) -> {
                    combiner.accept(left, right);
                    return left;
                },
                Collector.Characteristics.IDENTITY_FINISH
        );
    }

    public static <T> BinaryOperator<T> traceBinaryParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            BinaryOperator<T> op
    ) {
        return (t1, t2) -> {
            T result = op.apply(t1, t2);
            traceStream("END", result, name, id, streamId, paramAsString, String.valueOf(result));
            return result;
        };
    }
    public static IntBinaryOperator traceBinaryParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            IntBinaryOperator op
    ) {
        return (a, b) -> {
            int result = op.applyAsInt(a, b);
            traceStream("END", result, name, id, streamId, paramAsString, String.valueOf(result));
            return result;
        };
    }
    public static DoubleBinaryOperator traceBinaryParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            DoubleBinaryOperator op
    ) {
        return (a, b) -> {
            double result = op.applyAsDouble(a, b);
            traceStream("END", result, name, id, streamId, paramAsString,String.valueOf(result));
            return result;
        };
    }
    public static LongBinaryOperator traceBinaryParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            LongBinaryOperator op
    ) {
        return (a, b) -> {
            long result = op.applyAsLong(a, b);
            traceStream("END", result, name, id, streamId, paramAsString, String.valueOf(result));
            return result;
        };
    }
    public static <T, U> BiFunction<U, ? super T, U> traceBiParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            BiFunction<U, ? super T, U> accumulator
    ) {
        return (u, t) -> {
            U result = accumulator.apply(u, t);
            traceStream("END", result, name, id, streamId, paramAsString, String.valueOf(result));
            return result;
        };
    }

    public static <T> Predicate<T> traceParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            Predicate<T> base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, name, id, streamId, paramAsString, Boolean.toString(result));
            return result;
        };
    }
    public static IntPredicate traceIntParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            IntPredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, name, id, streamId, paramAsString, Boolean.toString(result));
            return result;
        };
    }
    public static DoublePredicate traceDoubleParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            DoublePredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, name, id, streamId, paramAsString, Boolean.toString(result));
            return result;
        };
    }
    public static LongPredicate traceLongParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            LongPredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, name, id, streamId, paramAsString, Boolean.toString(result));
            return result;
        };
    }

    public static <T>Comparator<T> traceParam(
            String name,
            int id,
            int streamId,
            String paramAsString,
            Comparator<T> base
    ) {
        return (t1, t2) -> {
            int result = base.compare(t1, t2);
            if (result < 0) {
                traceStream("END", t1, name, id, streamId, paramAsString, Integer.toString(result));
            } else {
                traceStream("END", t2, name, id, streamId, paramAsString, Integer.toString(result));
            }
            return result;
        };
    }

    private static String stateToString(Object obj) {
        if (obj instanceof double[]) return Arrays.toString((double[]) obj);
        if (obj instanceof int[])    return Arrays.toString((int[]) obj);
        if (obj instanceof long[])   return Arrays.toString((long[]) obj);
        if (obj instanceof Object[]) return Arrays.deepToString((Object[]) obj);
        return obj.toString();
    }

    public static void collectAndTransformStreamOperationValues() {}
}
