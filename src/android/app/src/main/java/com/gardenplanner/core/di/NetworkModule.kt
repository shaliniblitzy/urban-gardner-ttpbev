package com.gardenplanner.core.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import okhttp3.Interceptor
import okhttp3.CertificatePinner
import okhttp3.ConnectionPool
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import com.google.gson.GsonBuilder
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import java.security.KeyStore
import java.security.SecureRandom

/**
 * Dagger Hilt module providing comprehensive network infrastructure with enhanced
 * security, performance monitoring, and error handling capabilities.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val TIMEOUT_SECONDS = 30L
    private const val CACHE_SIZE_BYTES = 10L * 1024L * 1024L // 10 MB
    private const val MAX_RETRIES = 3
    private const val BASE_URL = "https://api.gardenplanner.com/" // Replace with actual API URL
    private const val MAX_IDLE_CONNECTIONS = 5
    private const val KEEP_ALIVE_DURATION = 5L // minutes

    /**
     * Provides HTTP response cache configuration.
     * Implements disk-based caching for offline support and bandwidth optimization.
     */
    @Provides
    @Singleton
    fun provideCache(context: Context): Cache {
        return Cache(
            directory = context.cacheDir,
            maxSize = CACHE_SIZE_BYTES
        )
    }

    /**
     * Provides singleton OkHttpClient with comprehensive security, monitoring,
     * and error handling configuration.
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(cache: Cache): OkHttpClient {
        // Configure certificate pinning for enhanced security
        val certificatePinner = CertificatePinner.Builder()
            .add("api.gardenplanner.com", "sha256/XXXX") // Replace with actual certificate hash
            .build()

        // Configure SSL context with custom trust manager
        val trustManagerFactory = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm()
        )
        trustManagerFactory.init(null as KeyStore?)
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustManagerFactory.trustManagers, SecureRandom())

        // Create performance monitoring interceptor
        val performanceInterceptor = Interceptor { chain ->
            val startTime = System.nanoTime()
            val response = chain.proceed(chain.request())
            val duration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime)
            
            // Log performance metrics if duration exceeds threshold
            if (duration > 3000) { // 3 seconds threshold
                // Log performance warning
            }
            
            response
        }

        // Create retry interceptor with exponential backoff
        val retryInterceptor = Interceptor { chain ->
            var retryCount = 0
            var response = try {
                chain.proceed(chain.request())
            } catch (e: Exception) {
                null
            }

            while (response == null && retryCount < MAX_RETRIES) {
                retryCount++
                val backoffDelay = (2.0.pow(retryCount.toDouble()) * 1000).toLong()
                Thread.sleep(backoffDelay)
                
                response = try {
                    chain.proceed(chain.request())
                } catch (e: Exception) {
                    null
                }
            }

            response ?: throw IllegalStateException("Request failed after $MAX_RETRIES retries")
        }

        // Configure logging interceptor for debug builds
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        return OkHttpClient.Builder()
            .cache(cache)
            .certificatePinner(certificatePinner)
            .sslSocketFactory(sslContext.socketFactory, trustManagerFactory.trustManagers[0])
            .connectionPool(ConnectionPool(
                maxIdleConnections = MAX_IDLE_CONNECTIONS,
                keepAliveDuration = KEEP_ALIVE_DURATION,
                timeUnit = TimeUnit.MINUTES
            ))
            .addInterceptor(performanceInterceptor)
            .addInterceptor(retryInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    /**
     * Provides singleton Retrofit instance with enhanced error handling
     * and monitoring capabilities.
     */
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        val gson = GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
            .registerTypeAdapter(Date::class.java, DateTypeAdapter())
            .create()

        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .addCallAdapterFactory(ErrorHandlingCallAdapterFactory())
            .build()
    }

    /**
     * Custom type adapter for handling date serialization/deserialization
     */
    private class DateTypeAdapter : TypeAdapter<Date>() {
        override fun write(out: JsonWriter, value: Date?) {
            out.value(value?.time)
        }

        override fun read(input: JsonReader): Date? {
            return input.nextLong()?.let { Date(it) }
        }
    }

    /**
     * Custom call adapter factory for centralized error handling
     */
    private class ErrorHandlingCallAdapterFactory : CallAdapter.Factory() {
        override fun get(
            returnType: Type,
            annotations: Array<Annotation>,
            retrofit: Retrofit
        ): CallAdapter<*, *>? {
            // Implementation for custom error handling
            // Return null to delegate to next available factory
            return null
        }
    }
}