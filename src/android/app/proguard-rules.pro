# Garden Planner Android Application ProGuard Rules
# Version: 1.0
# Dependencies:
# - androidx.room:room-runtime:2.5.2
# - com.google.dagger:hilt-android:2.47
# - com.google.firebase:firebase-messaging:23.2.1

####################################
# Optimization Configuration
####################################
-optimizationpasses 7
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-allowaccessmodification
-dontpreverify
-dontusemixedcaseclassnames
-verbose

# Enable aggressive optimizations
-repackageclasses com.gardenplanner
-flattenpackagehierarchy com.gardenplanner
-overloadaggressively

####################################
# Keep Rules for Domain Models
####################################
# Garden model and its components
-keep class com.gardenplanner.domain.models.Garden { *; }
-keep class com.gardenplanner.domain.models.Garden$Zone { *; }
-keep class com.gardenplanner.domain.models.Garden$Companion { *; }

# Plant model
-keep class com.gardenplanner.domain.models.Plant { *; }
-keep class com.gardenplanner.domain.models.Plant$Companion { *; }

# Schedule model
-keep class com.gardenplanner.domain.models.Schedule { *; }
-keep class com.gardenplanner.domain.models.Schedule$Companion { *; }

# Preserve Parcelable implementation
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
    public static final ** CREATOR;
}

####################################
# Database Configuration
####################################
# Room Database
-keep class androidx.room.** { *; }
-keepclassmembers class * extends androidx.room.RoomDatabase {
    abstract androidx.room.RoomDatabase.Builder roomBuilder(...);
}
-keepclassmembers @androidx.room.Entity class * { *; }
-keepclassmembers @androidx.room.Dao class * { *; }

####################################
# Dependency Injection
####################################
# Dagger Hilt
-keep class com.google.dagger.hilt.** { *; }
-keepclassmembers class * {
    @javax.inject.* <fields>;
    @javax.inject.* <methods>;
}
-keepclasseswithmembers class * {
    @dagger.* <methods>;
}

####################################
# Firebase Configuration
####################################
# Firebase Cloud Messaging
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepclassmembers class * extends com.google.firebase.messaging.FirebaseMessagingService {
    void handleIntent(android.content.Intent);
}

####################################
# Security Enhancements
####################################
# Protect sensitive data classes
-keepclassmembers class com.gardenplanner.domain.models.** {
    private <fields>;
}

# Preserve cryptographic operations
-keepclassmembers class * extends javax.crypto.spec.SecretKeySpec {
    <init>(...);
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

####################################
# Performance Optimizations
####################################
# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Optimize JSON parsing
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Optimize method calls
-optimizations !method/removal/parameter
-optimizations !code/allocation/variable

####################################
# Miscellaneous
####################################
# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom view constructors
-keepclasseswithmembers class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep application class
-keep class com.gardenplanner.GardenPlannerApplication { *; }

# Keep enum values
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Preserve serializable classes
-keepclassmembers class * implements java.io.Serializable {
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}